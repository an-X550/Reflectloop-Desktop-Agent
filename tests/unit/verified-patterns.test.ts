import { describe, expect, it, vi } from 'vitest';
import { VerifiedPatternService } from '../../src/main-process/application/verified-patterns';
import type { Review, VerifiedPattern } from '../../src/shared/schemas/domain';

const review: Review = {
  schemaVersion: 2, id: 'review_a1', type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16',
  sourceIds: ['journal_a1'], sourceVersions: [], projectId: null, provider: 'openai-compatible', model: 'fake',
  promptVersion: 'periodic-review-v2', createdAt: '2026-08-16T10:00:00.000Z', body: '本周上午专注有效',
};

const stored: VerifiedPattern = {
  schemaVersion: 1, id: 'pattern_x1', statement: '已有模式', evidenceSummary: '证据', sourceReviewIds: ['review_a1'], createdAt: '2026-08-01T10:00:00.000Z',
};

const makeRepo = () => {
  const added: VerifiedPattern[] = [];
  return {
    added,
    list: vi.fn(async () => ({ schemaVersion: 1 as const, updatedAt: '2026-08-16T10:00:00.000Z', patterns: [stored] })),
    add: vi.fn(async (value: VerifiedPattern) => { added.push(value); }),
  };
};

describe('VerifiedPatternService.propose', () => {
  it('returns model-proposed candidates bound to the source review without persisting them', async () => {
    const repo = makeRepo();
    const collect = vi.fn().mockResolvedValue(JSON.stringify({
      candidates: [{ statement: '上午先关闭消息时更容易完成核心交付', evidenceSummary: '本周三次上午专注后完成交付' }],
    }));
    const service = new VerifiedPatternService(
      { get: async () => review } as never,
      repo as never,
      { collect } as never,
      () => '2026-08-16T12:00:00.000Z',
    );
    const candidates = await service.propose({ reviewId: 'review_a1', model: 'fake' });
    expect(candidates).toEqual([{ statement: '上午先关闭消息时更容易完成核心交付', evidenceSummary: '本周三次上午专注后完成交付', sourceReviewIds: ['review_a1'] }]);
    expect(repo.add).not.toHaveBeenCalled();
  });

  it('rejects invalid model output instead of saving it', async () => {
    const repo = makeRepo();
    const service = new VerifiedPatternService(
      { get: async () => review } as never,
      repo as never,
      { collect: async () => 'not json' } as never,
    );
    await expect(service.propose({ reviewId: 'review_a1', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    expect(repo.add).not.toHaveBeenCalled();
  });

  it('caps the number of candidates the model can propose', async () => {
    const repo = makeRepo();
    const many = Array.from({ length: 6 }, (_, index) => ({ statement: `候选${index}`, evidenceSummary: `证据${index}` }));
    const service = new VerifiedPatternService(
      { get: async () => review } as never,
      repo as never,
      { collect: async () => JSON.stringify({ candidates: many }) } as never,
    );
    const candidates = await service.propose({ reviewId: 'review_a1', model: 'fake' });
    expect(candidates.length).toBeLessThanOrEqual(3);
  });
});

describe('VerifiedPatternService.confirm', () => {
  it('persists a user-confirmed candidate with an id and timestamp', async () => {
    const repo = makeRepo();
    const service = new VerifiedPatternService(
      { get: async () => review } as never,
      repo as never,
      { collect: async () => '{}' } as never,
      () => '2026-08-16T12:00:00.000Z',
    );
    const confirmed = await service.confirm({ statement: '上午先关闭消息时更容易完成核心交付', evidenceSummary: '本周三次上午专注后完成交付', sourceReviewIds: ['review_a1'] });
    expect(confirmed.id).toMatch(/^pattern_[a-z0-9]+$/);
    expect(confirmed.createdAt).toBe('2026-08-16T12:00:00.000Z');
    expect(repo.add).toHaveBeenCalledOnce();
    expect(repo.added[0]).toMatchObject({ statement: '上午先关闭消息时更容易完成核心交付', sourceReviewIds: ['review_a1'] });
  });

  it('exposes the confirmed snapshot through list', async () => {
    const repo = makeRepo();
    const service = new VerifiedPatternService({ get: async () => review } as never, repo as never, { collect: async () => '{}' } as never);
    const snapshot = await service.list();
    expect(snapshot.patterns.map((item) => item.id)).toEqual(['pattern_x1']);
  });
});
