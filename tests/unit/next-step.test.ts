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
const review = (input: Pick<Review, 'id' | 'type' | 'periodStart' | 'periodEnd'> & { sourceIds?: string[]; sourceVersions?: { id: string; updatedAt: string }[] }): Review => ({
  schemaVersion: 2,
  sourceIds: [],
  sourceVersions: [],
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
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'], sourceVersions: [{ id: 'journal_today', updatedAt: `${today}T01:00:00.000Z` }] })];
    expect(resolveNextStep({ today, dayOfWeek: 6, journals, reviews })).toMatchObject({
      kind: 'weekly-review',
      target: { view: 'reviews', intent: { type: 'review.weekly' } },
    });
  });

  it('does not repeat a weekly recommendation when the current week is covered', () => {
    const journals = [journal('journal_1', '2026-08-10'), journal('journal_2', '2026-08-13'), journal('journal_today', today)];
    const reviews = [
      review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'], sourceVersions: [{ id: 'journal_today', updatedAt: `${today}T01:00:00.000Z` }] }),
      review({ id: 'weekly_current', type: 'weekly', periodStart: '2026-08-10', periodEnd: '2026-08-16' }),
    ];
    expect(resolveNextStep({ today, dayOfWeek: 6, journals, reviews })).toMatchObject({ kind: 'recent-records' });
  });

  it('falls back to recent records on an ordinary weekday', () => {
    const journals = [journal('journal_today', today)];
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceIds: ['journal_today'], sourceVersions: [{ id: 'journal_today', updatedAt: `${today}T01:00:00.000Z` }] })];
    expect(resolveNextStep({ today, dayOfWeek: 3, journals, reviews })).toMatchObject({
      kind: 'recent-records',
      target: { view: 'journal', intent: { type: 'records.journals' } },
    });
  });

  it('suggests a monthly review near month start when two weekly reviews exist', () => {
    const monthToday = '2026-09-02';
    const journals = [journal('journal_today', monthToday)];
    const reviews = [
      review({ id: 'daily_today', type: 'daily', periodStart: monthToday, periodEnd: monthToday, sourceVersions: [{ id: 'journal_today', updatedAt: `${monthToday}T01:00:00.000Z` }] }),
      review({ id: 'weekly_1', type: 'weekly', periodStart: '2026-08-03', periodEnd: '2026-08-09' }),
      review({ id: 'weekly_2', type: 'weekly', periodStart: '2026-08-17', periodEnd: '2026-08-23' }),
    ];
    expect(resolveNextStep({ today: monthToday, dayOfWeek: 3, journals, reviews })).toMatchObject({ kind: 'monthly-review', target: { view: 'reviews', intent: { type: 'review.monthly', month: '2026-08' } } });
  });

  it('suggests an annual review only after six monthly reviews', () => {
    const yearToday = '2027-01-05';
    const journals = [journal('journal_today', yearToday)];
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: yearToday, periodEnd: yearToday, sourceVersions: [{ id: 'journal_today', updatedAt: `${yearToday}T01:00:00.000Z` }] }), ...Array.from({ length: 6 }, (_, index) => review({ id: `monthly_${index}`, type: 'monthly', periodStart: `2026-${String(index + 1).padStart(2, '0')}-01`, periodEnd: `2026-${String(index + 1).padStart(2, '0')}-28` }))];
    expect(resolveNextStep({ today: yearToday, dayOfWeek: 2, journals, reviews })).toMatchObject({ kind: 'yearly-review', target: { view: 'reviews', intent: { type: 'review.yearly', year: '2026' } } });
  });

  it('suggests an occasional quality check after seven recent journals', () => {
    const journals = Array.from({ length: 7 }, (_, index) => journal(index === 6 ? 'journal_today' : `journal_${index}`, `2026-08-${String(9 + index).padStart(2, '0')}`));
    const reviews = [review({ id: 'daily_today', type: 'daily', periodStart: today, periodEnd: today, sourceVersions: [{ id: 'journal_today', updatedAt: `${today}T01:00:00.000Z` }] })];
    expect(resolveNextStep({ today, dayOfWeek: 3, journals, reviews })).toMatchObject({ kind: 'coach-review', target: { view: 'reviews', intent: { type: 'review.coach' } } });
  });
});
