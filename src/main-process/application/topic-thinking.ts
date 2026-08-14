import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { TopicConfirmResult, TopicContent, TopicDiscussResult, TopicIndexEntry, TopicMessage, TopicProposal, TopicSession, TopicStartResult } from '../../shared/schemas/domain';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import type { TopicRepository } from '../infrastructure/topics/topic-repository';
import type { TopicSessionStore } from '../infrastructure/topics/topic-session-store';
import { safeTopicName } from '../infrastructure/topics/topic-repository';
import { parseTopicSummaryOutput, topicDiscussPrompt, topicFirstDraftPrompt, topicSummaryPrompt, type TopicSummaryOutput } from '../prompts/topic-thinking-v1';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }

const MAX_REFERENCED_TOPICS = 2;
const MAX_CONTEXT_EXCERPT = 500;

function longestCommonSubstring(a: string, b: string): number {
  let best = 0;
  const previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const before = previous[j];
      previous[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
      diagonal = before;
      best = Math.max(best, previous[j]);
    }
  }
  return best;
}

/** 确定性主题匹配：标题、别名或核心问题与提问有至少两个字符的公共子串才召回，最多两条。 */
export function findRelatedTopics(question: string, entries: TopicIndexEntry[]): TopicIndexEntry[] {
  return entries
    .map((entry) => {
      const haystacks = [entry.title, entry.coreQuestion, ...entry.aliases];
      const score = Math.max(...haystacks.map((text) => longestCommonSubstring(question, text)));
      return { entry, score };
    })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REFERENCED_TOPICS)
    .map(({ entry }) => entry);
}

/**
 * 主题思考：讨论 — 展示差异 — 用户确认 — 沉淀。
 * 会话通过文件型 checkpoint 持久化，应用重启后可恢复；未经确认不写入任何主题文件。
 */
export class TopicThinkingService {
  constructor(
    private readonly topics: Pick<TopicRepository, 'listIndex' | 'getTopic' | 'saveTopic'>,
    private readonly sessions: Pick<TopicSessionStore, 'save' | 'load' | 'list' | 'remove'>,
    private readonly provider: ProviderPort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async start(input: { question: string; model: string; contextExcerpt?: string }): Promise<TopicStartResult> {
    const index = await this.topics.listIndex();
    const related = findRelatedTopics(input.question, index.entries);
    const referenced = await Promise.all(related.map(async (entry) => ({
      entry,
      body: await this.topics.getTopic(entry.topic).catch(() => ''),
    })));
    const contextExcerpt = input.contextExcerpt ? input.contextExcerpt.slice(0, MAX_CONTEXT_EXCERPT) : undefined;
    const raw = await this.provider.collect([
      { role: 'system', content: topicFirstDraftPrompt() },
      { role: 'user', content: JSON.stringify({
        question: input.question,
        referencedTopics: referenced.filter((item) => item.body).map((item) => ({ title: item.entry.title, body: item.body })),
        ...(contextExcerpt ? { contextExcerpt } : {}),
      }) },
    ]);
    const at = this.now();
    const session: TopicSession = {
      schemaVersion: 1,
      id: `topicsession_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      question: input.question,
      referencedTopics: related.map((entry) => entry.topic),
      messages: [
        { role: 'user', content: input.question, at },
        { role: 'assistant', content: raw, at: this.now() },
      ],
      createdAt: at,
      updatedAt: this.now(),
    };
    await this.sessions.save(session);
    return { sessionId: session.id, draft: raw, referencedTopics: related.map((entry) => ({ topic: entry.topic, title: entry.title })) };
  }

  async discuss(input: { sessionId: string; message: string; model: string }): Promise<TopicDiscussResult> {
    const session = await this.requireSession(input.sessionId);
    const history: TopicMessage[] = [...session.messages, { role: 'user', content: input.message, at: this.now() }];
    const raw = await this.provider.collect([
      { role: 'system', content: topicDiscussPrompt() },
      ...history.map((message) => ({ role: message.role, content: message.content })),
    ]);
    await this.sessions.save({
      ...session,
      messages: [...history, { role: 'assistant', content: raw, at: this.now() }],
      proposal: undefined,
      updatedAt: this.now(),
    });
    return { reply: raw };
  }

  private async summarize(payload: Record<string, unknown>, existingBody?: string): Promise<TopicSummaryOutput> {
    const raw = await this.provider.collect([
      { role: 'system', content: topicSummaryPrompt(existingBody) },
      { role: 'user', content: JSON.stringify(payload) },
    ], undefined, { jsonObject: true });
    try {
      return parseTopicSummaryOutput(raw);
    } catch {
      throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的主题归纳格式无效。' });
    }
  }

  private matchExisting(summary: TopicSummaryOutput, entries: TopicIndexEntry[]): TopicIndexEntry | undefined {
    const topic = safeTopicName(summary.title);
    return entries.find((entry) => entry.topic === topic || entry.title === summary.title || entry.aliases.some((alias) => summary.aliases.includes(alias) || alias === summary.title));
  }

  async proposeSummary(input: { sessionId: string; model: string }): Promise<TopicProposal> {
    const session = await this.requireSession(input.sessionId);
    const basePayload = { question: session.question, messages: session.messages };
    let summary = await this.summarize(basePayload);
    const existing = this.matchExisting(summary, (await this.topics.listIndex()).entries);
    let proposal: TopicProposal;
    if (existing) {
      const existingBody = await this.topics.getTopic(existing.topic).catch(() => '');
      summary = await this.summarize({ ...basePayload, existingBody }, existingBody);
      proposal = { mode: 'update', targetTopic: existing.topic, existingBody, summary };
    } else {
      proposal = { mode: 'create', summary };
    }
    await this.sessions.save({ ...session, proposal, updatedAt: this.now() });
    return proposal;
  }

  async confirm(input: { sessionId: string }): Promise<TopicConfirmResult> {
    const session = await this.requireSession(input.sessionId);
    const proposal = session.proposal;
    if (!proposal) throw appError({ code: 'INVALID_INPUT', message: '请先生成主题归纳，再确认沉淀。' });
    const topic = await this.topics.saveTopic(proposal.summary);
    await this.sessions.remove(input.sessionId);
    return { topic };
  }

  async list(): Promise<TopicIndexEntry[]> {
    return (await this.topics.listIndex()).entries;
  }

  async get(input: { topic: string }): Promise<TopicContent> {
    return { topic: input.topic, body: await this.topics.getTopic(input.topic) };
  }

  async listSessions(): Promise<TopicSession[]> {
    return this.sessions.list();
  }

  async resume(input: { sessionId: string }): Promise<TopicSession> {
    return this.requireSession(input.sessionId);
  }

  private async requireSession(sessionId: string): Promise<TopicSession> {
    const session = await this.sessions.load(sessionId);
    if (!session) throw appError({ code: 'INVALID_INPUT', message: '讨论会话不存在或已沉淀。' });
    return session;
  }
}
