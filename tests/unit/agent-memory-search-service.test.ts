import { describe, expect, it, vi } from 'vitest';
import { AgentMemorySearchService } from '../../src/main-process/agent/agent-memory-search-service';
import { agentEvidenceDemo } from '../fixtures/agent-evidence-demo';

type SearchInput = { query: string; limit?: number; alternates?: string[] };

function searchWithAlternates(service: AgentMemorySearchService, input: SearchInput) {
  return service.search(input);
}

function makeService() {
  const journals = {
    list: vi.fn(async () => [{
      schemaVersion: 1 as const,
      id: 'journal_a1',
      date: '2026-08-20',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
      projectIds: [],
      body: '今天验证了把行动拆成更小步骤，结果更容易完成。',
    }]),
  };
  const reviews = {
    list: vi.fn(async () => [{
      schemaVersion: 1 as const,
      id: 'review_a1',
      type: 'weekly' as const,
      periodStart: '2026-08-17',
      periodEnd: '2026-08-23',
      sourceIds: ['journal_a1'],
      projectId: null,
      provider: 'openai-compatible' as const,
      model: 'test',
      promptVersion: 'periodic-review-v1',
      createdAt: '2026-08-23T00:00:00.000Z',
      body: '本周项目方向更清晰，下一步继续验证行动拆解。',
    }]),
  };
  const verifiedPatterns = {
    list: vi.fn(async () => ({
      schemaVersion: 1 as const,
      updatedAt: '2026-08-23T00:00:00.000Z',
      patterns: [{
        schemaVersion: 1 as const,
        id: 'pattern_a1',
        statement: '拆小行动有助于持续执行。',
        evidenceSummary: '来自多个周期复盘的已确认证据。',
        sourceReviewIds: ['review_a1'],
        createdAt: '2026-08-23T00:00:00.000Z',
      }],
    })),
  };
  return { service: new AgentMemorySearchService(journals, reviews, verifiedPatterns), journals, reviews, verifiedPatterns };
}

function makeRankingService(bodies: Array<{ id: string; date: string; body: string }>) {
  return new AgentMemorySearchService(
    { list: vi.fn(async () => bodies.map((item) => ({ schemaVersion: 1 as const, ...item, createdAt: `${item.date}T00:00:00.000Z`, updatedAt: `${item.date}T00:00:00.000Z`, projectIds: [] }))) },
    { list: vi.fn(async () => []) },
    { list: vi.fn(async () => ({ schemaVersion: 1 as const, updatedAt: '2026-08-23T00:00:00.000Z', patterns: [] })) },
  );
}

function makeDemoService() {
  return new AgentMemorySearchService(
    { list: vi.fn(async () => agentEvidenceDemo.journals) },
    { list: vi.fn(async () => agentEvidenceDemo.reviews) },
    { list: vi.fn(async () => agentEvidenceDemo.patterns) },
  );
}

describe('AgentMemorySearchService', () => {
  it('recalls matching journals, reviews and verified patterns from one read-only search', async () => {
    const { service, journals, reviews, verifiedPatterns } = makeService();
    const result = await service.search({ query: '行动', limit: 8 });

    expect(result.hits.map((hit) => hit.id)).toEqual(expect.arrayContaining(['review_a1', 'journal_a1', 'pattern_a1']));
    expect(result.hits[0].excerpt).toContain('行动');
    expect(journals.list).toHaveBeenCalledOnce();
    expect(reviews.list).toHaveBeenCalledOnce();
    expect(verifiedPatterns.list).toHaveBeenCalledOnce();
  });

  it('returns stable date-descending results when scores tie and respects the limit', async () => {
    const service = makeRankingService([
      { id: 'journal_old', date: '2026-08-20', body: '行动记录。' },
      { id: 'journal_new', date: '2026-08-23', body: '行动记录。' },
    ]);
    const result = await service.search({ query: '行动', limit: 1 });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].date).toBe('2026-08-23');
  });

  it('uses a stable ID after score and date are tied', async () => {
    const service = makeRankingService([
      { id: 'journal_b', date: '2026-08-20', body: '行动记录。' },
      { id: 'journal_a', date: '2026-08-20', body: '行动记录。' },
    ]);

    const result = await service.search({ query: '行动', limit: 2 });

    expect(result.hits.map((hit) => hit.id)).toEqual(['journal_a', 'journal_b']);
  });

  it('recalls a natural Chinese compound query instead of treating the whole sentence as one term', async () => {
    const { service } = makeService();
    const result = await service.search({ query: '我以前是不是经常把行动拆成更小步骤？' });

    expect(result.hits.map((hit) => hit.id)).toContain('journal_a1');
    expect(result.hits.find((hit) => hit.id === 'journal_a1')?.excerpt).toContain('行动拆成更小步骤');
  });

  it('uses a bounded alternate query for a limited vocabulary difference', async () => {
    const { service } = makeService();
    const result = await searchWithAlternates(service, { query: '任务定得太大', alternates: ['行动 拆解 步骤'] });

    expect(result.hits.map((hit) => hit.id)).toContain('journal_a1');
    expect(result.hits.find((hit) => hit.id === 'journal_a1')?.excerpt).toContain('行动拆成更小步骤');
    expect(result.hits.find((hit) => hit.id === 'journal_a1')?.excerpt).not.toContain('行动 拆解 步骤');
  });

  it('does not invent a semantic match when no alternate query is supplied', async () => {
    const { service } = makeService();

    await expect(service.search({ query: '任务定得太大' })).resolves.toEqual({ hits: [] });
  });

  it('does not return a broad set of unrelated records for generic question words', async () => {
    const { service } = makeService();

    const result = await service.search({ query: '以前是不是经常' });

    expect(result.hits).toEqual([]);
  });

  it('returns no result for a phrase absent from the local sources', async () => {
    const { service } = makeService();

    await expect(service.search({ query: '完全不存在的内容' })).resolves.toEqual({ hits: [] });
  });

  it('returns a dated fact from the independent public demo fixture', async () => {
    const result = await makeDemoService().search({ query: '证据卡片验收' });

    expect(result.hits[0]).toMatchObject({ id: 'journal_fact_20260818', kind: 'journal', date: '2026-08-18' });
    expect(result.hits[0].excerpt).toContain('已完成证据卡片验收');
  });

  it('returns related evidence from more than one date for a pattern query', async () => {
    const result = await makeDemoService().search({ query: '小步骤' });
    const dates = new Set(result.hits.filter((hit) => hit.kind === 'journal').map((hit) => hit.date));

    expect(dates).toEqual(new Set(['2026-08-19', '2026-08-21']));
  });

  it('keeps journal and review evidence visible when the sources conflict', async () => {
    const result = await makeDemoService().search({ query: '接口完成' });

    expect(result.hits.map((hit) => hit.id)).toEqual(expect.arrayContaining(['journal_conflict_20260822', 'review_conflict_20260822']));
    expect(result.hits.find((hit) => hit.id === 'journal_conflict_20260822')?.excerpt).toContain('已经完成');
    expect(result.hits.find((hit) => hit.id === 'review_conflict_20260822')?.excerpt).toContain('尚未完成');
  });

  it('returns an empty result for an absent demo query', async () => {
    await expect(makeDemoService().search({ query: '火星探测器' })).resolves.toEqual({ hits: [] });
  });
});
