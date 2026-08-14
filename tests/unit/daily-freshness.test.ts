import { describe, expect, it } from 'vitest';
import type { Review } from '../../src/shared/schemas/domain';
import { isDailyReviewFresh, sourceVersionsMatch, toSourceVersions, type SourceVersion } from '../../src/shared/domain/daily-freshness';

const today = '2026-08-15';
const versions = (items: [string, string][]): SourceVersion[] => items.map(([id, updatedAt]) => ({ id, updatedAt }));
const dailyReview = (input: { sourceVersions?: SourceVersion[]; schemaVersion?: 1 | 2; periodStart?: string; periodEnd?: string; type?: Review['type'] }): Review => {
  const base = {
    id: 'review_daily1',
    type: 'daily' as const,
    periodStart: today,
    periodEnd: today,
    sourceIds: ['journal_a'],
    projectId: null,
    provider: 'openai-compatible' as const,
    model: 'test',
    promptVersion: 'daily-review-v1',
    createdAt: `${today}T02:00:00.000Z`,
    body: '反馈正文',
  };
  if ((input.schemaVersion ?? 2) === 1) return { schemaVersion: 1, ...base, ...input, type: input.type ?? 'daily' } as Review;
  return { schemaVersion: 2, sourceVersions: [], ...base, ...input, type: input.type ?? 'daily' } as Review;
};

describe('toSourceVersions', () => {
  it('maps journals to sorted source versions (与 main/renderer 双端原实现一致)', () => {
    const journals = [
      { id: 'journal_b', updatedAt: `${today}T01:30:00.000Z` },
      { id: 'journal_a', updatedAt: `${today}T01:00:00.000Z` },
    ];
    expect(toSourceVersions(journals)).toEqual(versions([['journal_a', `${today}T01:00:00.000Z`], ['journal_b', `${today}T01:30:00.000Z`]]));
  });
});

describe('sourceVersionsMatch', () => {
  it('matches identical versions regardless of order', () => {
    const a = versions([['journal_a', 't1'], ['journal_b', 't2']]);
    const b = versions([['journal_b', 't2'], ['journal_a', 't1']]);
    expect(sourceVersionsMatch(a, b)).toBe(true);
  });

  it('detects an edited journal by updatedAt', () => {
    const a = versions([['journal_a', 't1']]);
    const b = versions([['journal_a', 't2']]);
    expect(sourceVersionsMatch(a, b)).toBe(false);
  });

  it('detects added or removed journals', () => {
    const a = versions([['journal_a', 't1']]);
    const b = versions([['journal_a', 't1'], ['journal_b', 't2']]);
    expect(sourceVersionsMatch(a, b)).toBe(false);
  });

  it('does not mutate caller arrays', () => {
    const a = versions([['journal_b', 't2'], ['journal_a', 't1']]);
    sourceVersionsMatch(a, versions([]));
    expect(a.map((item) => item.id)).toEqual(['journal_b', 'journal_a']);
  });
});

describe('isDailyReviewFresh', () => {
  const fresh = versions([['journal_a', `${today}T01:00:00.000Z`]]);

  it('accepts a schemaVersion-2 daily review whose sourceVersions match', () => {
    expect(isDailyReviewFresh(dailyReview({ sourceVersions: fresh }), today, fresh)).toBe(true);
  });

  it('rejects when the journal changed after generation', () => {
    expect(isDailyReviewFresh(dailyReview({ sourceVersions: fresh }), today, versions([['journal_a', `${today}T09:00:00.000Z`]]))).toBe(false);
  });

  it('rejects legacy schemaVersion-1 reviews', () => {
    expect(isDailyReviewFresh(dailyReview({ schemaVersion: 1 }), today, fresh)).toBe(false);
  });

  it('rejects reviews of other types or other dates', () => {
    expect(isDailyReviewFresh(dailyReview({ sourceVersions: fresh, type: 'weekly' }), today, fresh)).toBe(false);
    expect(isDailyReviewFresh(dailyReview({ sourceVersions: fresh, periodStart: '2026-08-14', periodEnd: '2026-08-14' }), today, fresh)).toBe(false);
  });

  it('rejects undefined review', () => {
    expect(isDailyReviewFresh(undefined, today, fresh)).toBe(false);
  });

  it('renderer 语义对照：periodEnd 命中当日且版本一致即视为已有反馈', () => {
    const review = dailyReview({ sourceVersions: fresh });
    const rendererFresh = [review].some((item) => isDailyReviewFresh(item, today, fresh));
    expect(rendererFresh).toBe(true);
  });

  it('main 语义对照：已有最新反馈时不重复生成', () => {
    const existing = dailyReview({ sourceVersions: fresh });
    expect(isDailyReviewFresh(existing, today, fresh)).toBe(true);
    const stale = dailyReview({ sourceVersions: versions([['journal_a', `${today}T00:30:00.000Z`]]) });
    expect(isDailyReviewFresh(stale, today, fresh)).toBe(false);
  });
});
