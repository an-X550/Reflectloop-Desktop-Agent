import { AgentToolBridgeRequestSchema, AgentToolResultSchema, type AgentNavigationTarget, type AgentPresentationCard, type AgentToolBridgeRequest, type AgentToolResult } from '../../shared/schemas/agent-tools';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import type { JsonProjectRepository } from '../infrastructure/markdown/project-repository';
import type { TopicThinkingService } from '../application/topic-thinking';
import type { VerifiedPatternService } from '../application/verified-patterns';
import type { WebSearchService } from '../infrastructure/web/web-search-service';

const PATH_OR_URL = /(?:[a-z]:[\\/]|\\\\|\/[a-z0-9._~-]+(?:[\\/]|$)|https?:\/\/)/i;

function safeText(value: string, limit = 1_000): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return PATH_OR_URL.test(normalized) ? '内容包含受保护位置，已省略。' : (normalized || '暂无可展示内容。').slice(0, limit);
}

function safeError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (code === 'NOT_FOUND') return '未找到所需内容，可能已被移动或删除。';
  if (code === 'CANCELLED') return '已停止本次工具调用。';
  if (code === 'NETWORK_TIMEOUT' || code === 'WEB_SEARCH_FAILED' || code === 'WEB_SOURCE_FAILED') return '联网内容暂时不可用，请稍后重试。';
  if (code === 'INVALID_INPUT') return '工具输入不合法，已拒绝执行。';
  return '知己工具暂时无法完成请求，请稍后重试。';
}

/**
 * Main Process 的唯一 Agent 工具入口。Utility Process 即使是本地子进程也不被信任：
 * 每次调用都先经过共享 Zod 契约，随后只委托既有的只读服务，并把结果收敛为无路径、无 URL 的摘要。
 */
export class AgentToolDispatcher {
  constructor(private readonly deps: {
    journals: Pick<MarkdownJournalRepository, 'list' | 'get'>;
    reviews: Pick<MarkdownReviewRepository, 'list' | 'get'>;
    projects: Pick<JsonProjectRepository, 'list'>;
    topicThinking: Pick<TopicThinkingService, 'list' | 'get'>;
    verifiedPatterns: Pick<VerifiedPatternService, 'list'>;
    webSearch: Pick<WebSearchService, 'search' | 'readSource'>;
  }) {}

  async dispatch(raw: unknown): Promise<AgentToolResult> {
    const request = AgentToolBridgeRequestSchema.safeParse(raw);
    if (!request.success) return { kind: 'error', message: '工具请求格式不合法，已拒绝执行。' };
    try {
      return AgentToolResultSchema.parse(await this.execute(request.data));
    } catch (error) {
      return { kind: 'error', message: safeError(error) };
    }
  }

  private async execute(request: AgentToolBridgeRequest): Promise<AgentToolResult> {
    switch (request.action) {
      case 'journals.list': {
        const journals = (await this.deps.journals.list()).filter((item) =>
          (!request.input.start || item.date >= request.input.start)
          && (!request.input.end || item.date <= request.input.end)
          && (!request.input.projectId || item.projectIds.includes(request.input.projectId)),
        );
        return { kind: 'journals.list', journals: journals.slice(-100).map((item) => ({ id: item.id, date: item.date, projectIds: item.projectIds, excerpt: safeText(item.body) })) };
      }
      case 'journals.get': {
        const item = await this.deps.journals.get(request.input.id);
        return { kind: 'journals.get', journal: { id: item.id, date: item.date, projectIds: item.projectIds, excerpt: safeText(item.body) } };
      }
      case 'reviews.list': {
        const reviews = await this.deps.reviews.list();
        return { kind: 'reviews.list', reviews: reviews.slice(-100).map((item) => ({ id: item.id, type: item.type, periodStart: item.periodStart, periodEnd: item.periodEnd, projectId: item.projectId, excerpt: safeText(item.body) })) };
      }
      case 'reviews.get': {
        const item = await this.deps.reviews.get(request.input.id);
        return { kind: 'reviews.get', review: { id: item.id, type: item.type, periodStart: item.periodStart, periodEnd: item.periodEnd, projectId: item.projectId, excerpt: safeText(item.body) } };
      }
      case 'projects.list': {
        const projects = await this.deps.projects.list();
        return { kind: 'projects.list', projects: projects.slice(-100).map((item) => ({ id: item.id, name: safeText(item.name, 80), status: item.status })) };
      }
      case 'topics.list': {
        const topics = await this.deps.topicThinking.list();
        return { kind: 'topics.list', topics: topics.slice(-100).map((item) => ({ topic: item.topic, title: safeText(item.title, 120), coreQuestion: safeText(item.coreQuestion, 500), aliases: item.aliases.map((alias) => safeText(alias, 80)) })) };
      }
      case 'topics.get': {
        const item = await this.deps.topicThinking.get(request.input);
        return { kind: 'topics.get', topic: { topic: item.topic, excerpt: safeText(item.body) } };
      }
      case 'patterns.list': {
        const snapshot = await this.deps.verifiedPatterns.list();
        return { kind: 'patterns.list', patterns: snapshot.patterns.slice(-100).map((item) => ({ id: item.id, statement: safeText(item.statement, 500), evidenceSummary: safeText(item.evidenceSummary), sourceReviewIds: item.sourceReviewIds })) };
      }
      case 'web.search': {
        const response = await this.deps.webSearch.search(request.input);
        return { kind: 'web.search', searchSessionId: response.searchSessionId, results: response.results.map((item) => ({ sourceId: item.sourceId, title: safeText(item.title, 300), snippet: safeText(item.snippet) })) };
      }
      case 'web.read-source': {
        const source = await this.deps.webSearch.readSource(request.input);
        return { kind: 'web.read-source', source: { title: safeText(source.title, 300), excerpt: safeText(source.excerpt, 2_000) } };
      }
      case 'ui.navigate': {
        await this.assertKnownNavigation(request.input.target);
        return { kind: 'ui.navigate', target: request.input.target };
      }
      case 'ui.present': {
        await Promise.all(request.input.links.map((link) => this.assertKnownNavigation(link.target)));
        return { kind: 'ui.present', card: this.safeCard(request.input) };
      }
    }
  }

  private safeCard(card: AgentPresentationCard): AgentPresentationCard {
    return { title: safeText(card.title, 120), summary: safeText(card.summary), links: card.links.map((link) => ({ label: safeText(link.label, 80), target: link.target })) };
  }

  private async assertKnownNavigation(target: AgentNavigationTarget): Promise<void> {
    if (target.view === 'reviews' && target.intent === 'project') {
      if (!(await this.deps.projects.list()).some((item) => item.id === target.projectId)) throw new Error('unknown project');
    }
  }
}
