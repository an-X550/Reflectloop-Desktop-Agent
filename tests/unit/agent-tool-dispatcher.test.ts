import { describe, expect, it, vi } from 'vitest';
import { AgentToolDispatcher } from '../../src/main-process/agent/agent-tool-dispatcher';

const sessionId = 'agent_tooltest';
const request = (action: string, input: object) => ({ type: 'tool.request' as const, requestId: crypto.randomUUID(), sessionId, action, input });

function makeDispatcher() {
  const journals = { list: vi.fn(async () => [{ schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-20', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z', projectIds: ['project_a1'], body: '今天在 /private/journal 写下感受。' }]), get: vi.fn() };
  const reviews = { list: vi.fn(async () => [{ schemaVersion: 1 as const, id: 'review_a1', type: 'weekly' as const, periodStart: '2026-08-10', periodEnd: '2026-08-16', sourceIds: ['journal_a1'], projectId: null, provider: 'openai-compatible' as const, model: 'test', promptVersion: 'periodic-review-v1', createdAt: '2026-08-20T00:00:00.000Z', body: '本周收获明确。' }]), get: vi.fn() };
  const projects = { list: vi.fn(async () => [{ schemaVersion: 1 as const, id: 'project_a1', name: '桌面端', status: 'active' as const, createdAt: '2026-08-20T00:00:00.000Z', archivedAt: null }]) };
  const topicThinking = { list: vi.fn(async () => []), get: vi.fn() };
  const verifiedPatterns = { list: vi.fn(async () => ({ schemaVersion: 1 as const, updatedAt: '2026-08-20T00:00:00.000Z', patterns: [] })) };
  const webSearch = {
    search: vi.fn(async () => ({ searchSessionId: 'search_a1', results: [{ sourceId: 'source_a1', title: '可信来源', url: 'https://example.com/private', snippet: '搜索摘要', publishedAt: null, retrievedAt: '2026-08-20T00:00:00.000Z' }] })),
    readSource: vi.fn(async (input: { searchSessionId: string; sourceId: string }) => {
      if (input.searchSessionId !== 'search_a1' || input.sourceId !== 'source_a1') throw Object.assign(new Error('bad source'), { code: 'INVALID_INPUT' });
      return { title: '可信来源', url: 'https://example.com/private', publishedAt: null, excerpt: '来源正文' };
    }),
  };
  return { dispatcher: new AgentToolDispatcher({ journals, reviews, projects, topicThinking, verifiedPatterns, webSearch }), journals, reviews, webSearch };
}

describe('AgentToolDispatcher', () => {
  it('combines two read-only domains and returns task-ready summaries without paths', async () => {
    const { dispatcher, journals, reviews } = makeDispatcher();
    const journalResult = await dispatcher.dispatch(request('journals.list', {}));
    const reviewResult = await dispatcher.dispatch(request('reviews.list', {}));

    expect(journals.list).toHaveBeenCalledOnce();
    expect(reviews.list).toHaveBeenCalledOnce();
    expect(journalResult).toEqual({ kind: 'journals.list', journals: [{ id: 'journal_a1', date: '2026-08-20', projectIds: ['project_a1'], excerpt: '内容包含受保护位置，已省略。' }] });
    expect(JSON.stringify(reviewResult)).not.toMatch(/[A-Za-z]:[\\/]|https?:\/\//);
  });

  it('rejects unknown input and arbitrary URL before any service call', async () => {
    const { dispatcher, webSearch } = makeDispatcher();
    const result = await dispatcher.dispatch({ ...request('web.read-source', { searchSessionId: 'search_a1', sourceId: 'source_a1', url: 'https://attacker.example' }) });

    expect(result).toEqual({ kind: 'error', message: '工具请求格式不合法，已拒绝执行。' });
    expect(webSearch.readSource).not.toHaveBeenCalled();
  });

  it('keeps source reads bound to the search session and never exposes result URLs', async () => {
    const { dispatcher, webSearch } = makeDispatcher();
    const search = await dispatcher.dispatch(request('web.search', { query: '复盘方法' }));
    const rejected = await dispatcher.dispatch(request('web.read-source', { searchSessionId: 'search_other', sourceId: 'source_a1' }));
    const accepted = await dispatcher.dispatch(request('web.read-source', { searchSessionId: 'search_a1', sourceId: 'source_a1' }));

    expect(search).toEqual({ kind: 'web.search', searchSessionId: 'search_a1', results: [{ sourceId: 'source_a1', title: '可信来源', snippet: '搜索摘要' }] });
    expect(rejected).toEqual({ kind: 'error', message: '工具输入不合法，已拒绝执行。' });
    expect(accepted).toEqual({ kind: 'web.read-source', source: { title: '可信来源', excerpt: '来源正文' } });
    expect(JSON.stringify(accepted)).not.toContain('https://');
    expect(webSearch.readSource).toHaveBeenCalledTimes(2);
  });

  it('allows navigation only to a valid existing product target', async () => {
    const { dispatcher } = makeDispatcher();
    const valid = await dispatcher.dispatch(request('ui.navigate', { target: { view: 'reviews', intent: 'project', projectId: 'project_a1' } }));
    const missing = await dispatcher.dispatch(request('ui.navigate', { target: { view: 'reviews', intent: 'project', projectId: 'project_missing' } }));

    expect(valid).toEqual({ kind: 'ui.navigate', target: { view: 'reviews', intent: 'project', projectId: 'project_a1' } });
    expect(missing).toEqual({ kind: 'error', message: '知己工具暂时无法完成请求，请稍后重试。' });
  });
});
