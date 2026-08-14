import { describe, expect, it, vi } from 'vitest';
import { TopicThinkingService } from '../../src/main-process/application/topic-thinking';
import { topicFirstDraftPrompt, topicSummaryPrompt } from '../../src/main-process/prompts/topic-thinking-v1';
import type { TopicIndexEntry, TopicSession } from '../../src/shared/schemas/domain';

const entry: TopicIndexEntry = { topic: '职业选择', title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: ['行业选择'], updatedAt: '2026-08-01T10:00:00.000Z' };

const summaryOutput = JSON.stringify({
  title: '换工作时机', coreQuestion: '我应该现在换工作吗？', aliases: ['跳槽时机'],
  body: '# 换工作时机\n\n## 2. 当前判断：现金流未满六个月前不主动换\n\n依据：讨论中提到存款约束。',
});

const makeTopics = () => {
  const saved: { title: string; coreQuestion: string; aliases: string[]; body: string }[] = [];
  return {
    saved,
    listIndex: vi.fn(async () => ({ schemaVersion: 1 as const, entries: [entry] })),
    getTopic: vi.fn(async (topic: string) => `# ${topic} 旧正文`),
    saveTopic: vi.fn(async (input: { title: string; coreQuestion: string; aliases: string[]; body: string }) => { saved.push(input); return input.title; }),
  };
};

const makeSessions = (existing?: TopicSession) => {
  const saved: TopicSession[] = [];
  const removed: string[] = [];
  let current = existing ?? null;
  return {
    saved, removed,
    save: vi.fn(async (value: TopicSession) => { saved.push(value); current = value; }),
    load: vi.fn(async () => current),
    list: vi.fn(async () => (current ? [current] : [])),
    remove: vi.fn(async (id: string) => { removed.push(id); if (current?.id === id) current = null; }),
  };
};

const firstDraft = '先回答当前问题：现金流约束决定时机。';

describe('TopicThinkingService.start', () => {
  it('creates a checkpointed session with a first draft and references at most two related topics', async () => {
    const topics = makeTopics();
    const sessions = makeSessions();
    const collect = vi.fn().mockResolvedValue(firstDraft);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never, () => '2026-08-14T10:00:00.000Z');
    const result = await service.start({ question: '化债背景下我应该现在换工作选行业吗？', model: 'fake' });
    expect(result.sessionId).toMatch(/^topicsession_[a-z0-9]+$/);
    expect(result.draft).toBe(firstDraft);
    expect(result.referencedTopics.map((item) => item.topic)).toEqual(['职业选择']);
    expect(topics.getTopic).toHaveBeenCalledWith('职业选择');
    expect(sessions.save).toHaveBeenCalledOnce();
    expect(sessions.saved[0].messages).toHaveLength(2);
  });

  it('does not read any topic body when nothing matches', async () => {
    const topics = makeTopics();
    const sessions = makeSessions();
    const collect = vi.fn().mockResolvedValue(firstDraft);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const result = await service.start({ question: '亲子关系中的边界怎么把握？', model: 'fake' });
    expect(result.referencedTopics).toEqual([]);
    expect(topics.getTopic).not.toHaveBeenCalled();
  });

  it('injects a caller-provided context excerpt into the first-draft user payload', async () => {
    const topics = makeTopics();
    const sessions = makeSessions();
    const collect = vi.fn().mockResolvedValue(firstDraft);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    await service.start({ question: '化债背景下我应该选什么行业？', model: 'fake', contextExcerpt: '日反馈里提到现金流紧张。' });
    const userPayload = JSON.parse(collect.mock.calls[0][0][1].content);
    expect(userPayload.contextExcerpt).toBe('日反馈里提到现金流紧张。');
    expect(topicFirstDraftPrompt()).toContain('背景摘录');
    expect(topicFirstDraftPrompt()).toContain('可回查引用');
  });

  it('truncates an oversized context excerpt to 500 characters and does not persist it into the checkpoint', async () => {
    const topics = makeTopics();
    const sessions = makeSessions();
    const collect = vi.fn().mockResolvedValue(firstDraft);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const long = '长'.repeat(600);
    await service.start({ question: '一个长期困惑', model: 'fake', contextExcerpt: long });
    const userPayload = JSON.parse(collect.mock.calls[0][0][1].content);
    expect(userPayload.contextExcerpt).toHaveLength(500);
    expect(JSON.stringify(sessions.saved[0])).not.toContain(long);
  });
});

describe('TopicThinkingService.discuss', () => {
  const existing: TopicSession = {
    schemaVersion: 1, id: 'topicsession_a1', question: '我应该现在换工作吗？', referencedTopics: [],
    messages: [{ role: 'user', content: '我应该现在换工作吗？', at: '2026-08-14T09:00:00.000Z' }],
    createdAt: '2026-08-14T09:00:00.000Z', updatedAt: '2026-08-14T09:00:00.000Z',
  };

  it('appends the user message and reply to the checkpoint', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue('追问后的回复');
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never, () => '2026-08-14T10:00:00.000Z');
    const result = await service.discuss({ sessionId: 'topicsession_a1', message: '我还有六个月存款', model: 'fake' });
    expect(result.reply).toBe('追问后的回复');
    const checkpoint = sessions.saved.at(-1);
    expect(checkpoint?.messages.map((item) => item.role)).toEqual(['user', 'user', 'assistant']);
  });

  it('rejects discussion on an unknown session', async () => {
    const service = new TopicThinkingService(makeTopics() as never, makeSessions() as never, { collect: vi.fn() } as never);
    await expect(service.discuss({ sessionId: 'topicsession_unknown', message: 'hi', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('TopicThinkingService.proposeSummary', () => {
  const existing: TopicSession = {
    schemaVersion: 1, id: 'topicsession_a1', question: '我应该现在换工作吗？', referencedTopics: [],
    messages: [{ role: 'user', content: '我应该现在换工作吗？', at: '2026-08-14T09:00:00.000Z' }, { role: 'assistant', content: '先看现金流。', at: '2026-08-14T09:01:00.000Z' }],
    createdAt: '2026-08-14T09:00:00.000Z', updatedAt: '2026-08-14T09:00:00.000Z',
  };

  it('proposes a validated summary without writing anything', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue(summaryOutput);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const proposal = await service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' });
    expect(proposal.mode).toBe('create');
    expect(proposal.summary.title).toBe('换工作时机');
    expect(topics.saveTopic).not.toHaveBeenCalled();
  });

  it('detects an update against an existing topic and exposes the current body for diff', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue(JSON.stringify({ title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: [], body: '# 职业选择\n新正文' }));
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const proposal = await service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' });
    expect(proposal.mode).toBe('update');
    expect(proposal.targetTopic).toBe('职业选择');
    expect(proposal.existingBody).toContain('旧正文');
    expect(topics.saveTopic).not.toHaveBeenCalled();
  });

  it('feeds the old body back into the summary prompt on update to reorganize the whole argument', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue(JSON.stringify({ title: '职业选择', coreQuestion: '化债背景下选什么行业？', aliases: [], body: '# 职业选择\n重组后的整篇论证' }));
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    await service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' });
    expect(collect).toHaveBeenCalledTimes(2);
    const mergePayload = JSON.parse(collect.mock.calls[1][0][1].content);
    expect(mergePayload.existingBody).toContain('旧正文');
    expect(topicSummaryPrompt('# 旧正文')).toContain('重组整篇当前论证');
  });

  it('summarizes in a single pass for a brand-new topic and omits existingBody', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue(summaryOutput);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const proposal = await service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' });
    expect(proposal.mode).toBe('create');
    expect(collect).toHaveBeenCalledTimes(1);
    expect(collect.mock.calls[0][0][1].content).not.toContain('existingBody');
  });

  it('rejects invalid model output', async () => {
    const service = new TopicThinkingService(makeTopics() as never, makeSessions(existing) as never, { collect: async () => 'not json' } as never);
    await expect(service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
  });
});

describe('TopicThinkingService.confirm', () => {
  const existing: TopicSession = {
    schemaVersion: 1, id: 'topicsession_a1', question: '我应该现在换工作吗？', referencedTopics: [],
    messages: [{ role: 'user', content: '我应该现在换工作吗？', at: '2026-08-14T09:00:00.000Z' }],
    createdAt: '2026-08-14T09:00:00.000Z', updatedAt: '2026-08-14T09:00:00.000Z',
  };

  it('persists the proposed topic and removes the checkpoint only after user confirmation', async () => {
    const topics = makeTopics();
    const sessions = makeSessions(existing);
    const collect = vi.fn().mockResolvedValue(summaryOutput);
    const service = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    await service.proposeSummary({ sessionId: 'topicsession_a1', model: 'fake' });
    const result = await service.confirm({ sessionId: 'topicsession_a1' });
    expect(result.topic).toBe('换工作时机');
    expect(topics.saveTopic).toHaveBeenCalledOnce();
    expect(topics.saved[0].body).toContain('当前判断');
    expect(sessions.removed).toEqual(['topicsession_a1']);
  });

  it('persists the proposal into the session checkpoint and confirms it after a service restart', async () => {
    const topics = makeTopics();
    const store: TopicSession[] = [];
    const sessions = {
      save: vi.fn(async (value: TopicSession) => { const index = store.findIndex((item) => item.id === value.id); if (index >= 0) store[index] = value; else store.push(value); }),
      load: vi.fn(async (id: string) => store.find((item) => item.id === id) ?? null),
      list: vi.fn(async () => store),
      remove: vi.fn(async (id: string) => { const index = store.findIndex((item) => item.id === id); if (index >= 0) store.splice(index, 1); }),
    };
    const collect = vi.fn().mockResolvedValue(summaryOutput);
    const first = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    await first.start({ question: '我应该现在换工作吗？', model: 'fake' });
    const sessionId = store[0].id;
    await first.proposeSummary({ sessionId, model: 'fake' });
    expect(store[0].proposal).toBeDefined();
    const restarted = new TopicThinkingService(topics as never, sessions as never, { collect } as never);
    const result = await restarted.confirm({ sessionId });
    expect(result.topic).toBe('换工作时机');
    expect(topics.saveTopic).toHaveBeenCalledOnce();
  });

  it('rejects confirmation without a prior proposal', async () => {
    const service = new TopicThinkingService(makeTopics() as never, makeSessions(existing) as never, { collect: vi.fn() } as never);
    await expect(service.confirm({ sessionId: 'topicsession_a1' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
