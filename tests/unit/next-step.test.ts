import { describe, expect, it } from 'vitest';
import type { Journal, Review } from '../../src/shared/schemas/domain';
import { resolveNextStep } from '../../src/renderer/domain/next-step';

const today = '2026-08-15';
const journal = (id: string, date: string): Journal => ({
  schemaVersion: 1,
  id,
  date,
  createdAt: `${date}T01:00:00.000Z`,
  updatedAt: `${date}T01:00:00.000Z`,
  projectIds: [],
  body: `${date} 日志`,
});
const review = (input: Partial<Review> & Pick<Review, 'id' | 'type' | 'periodStart' | 'periodEnd'>): Review => ({
  schemaVersion: 1,
  sourceIds: [],
  projectId: null,
  provider: 'openai-compatible',
  model: 'test',
  promptVersion: `${input.type}-review-v1`,
  createdAt: `${input.periodEnd}T02:00:00.000Z`,
  body: '复盘正文',
  ...input,
});

describe('resolveNextStep', () => {
  it('starts with writing when today has no journal', () => {
    expect(resolveNextStep({ today, dayOfWeek: 6, journals: [], reviews: [] })).toMatchObject({
      kind: 'write-journal',
      target: { view: 'journal', intent: { type: 'journal.compose' } },
    });
  });

  it('asks for daily feedback when today is saved but has no matching feedback', () => {
    expect(resolveNextStep({ today, dayOfWeek: 6, journals: [journal('journal_today', today)], reviews: [] })).toMatchObject({
      kind: 'generate-daily',
      target: { view: 'journal', intent: { type: 'journal.generate-daily' } },
    });
  });

  it('recommends a weekly review on the weekend with three journals and daily feedback', () => {
    const journals = [journal('journal_1', '2026-08-10'), journal('journal_2', '2026-08-13'), journal('journal_today', today)];
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'] })];
    expect(resolveNextStep({ today, dayOfWeek: 6, journals, reviews })).toMatchObject({
      kind: 'weekly-review',
      target: { view: 'reviews', intent: { type: 'review.weekly' } },
    });
  });

  it('does not repeat a weekly recommendation when the current week is covered', () => {
    const journals = [journal('journal_1', '2026-08-10'), journal('journal_2', '2026-08-13'), journal('journal_today', today)];
    const reviews = [
      review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'] }),
      review({ id: 'weekly_current', type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16' }),
    ];
    expect(resolveNextStep({ today, dayOfWeek: 6, journals, reviews })).toMatchObject({ kind: 'recent-records' });
  });

  it('falls back to recent records on an ordinary weekday', () => {
    const journals = [journal('journal_today', today)];
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'] })];
    expect(resolveNextStep({ today, dayOfWeek: 3, journals, reviews })).toMatchObject({
      kind: 'recent-records',
      target: { view: 'journal', intent: { type: 'records.journals' } },
    });
  });
});
