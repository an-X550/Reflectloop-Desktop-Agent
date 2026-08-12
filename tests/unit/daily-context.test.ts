import { describe, expect, it } from 'vitest';
import { buildDailyContext } from '../../src/main-process/domain/daily-context';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journal = (id: string, date: string): Journal => ({ schemaVersion: 1, id, date, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, projectIds: [], body: id });
const review = (id: string, date: string): Review => ({ schemaVersion: 1, id, type: 'daily', periodStart: date, periodEnd: date, sourceIds: ['journal_a1'], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'daily-review-v1', createdAt: `${date}T09:00:00.000Z`, body: id });

describe('buildDailyContext', () => {
  it('uses the selected day and latest prior daily review only', () => {
    const result = buildDailyContext(journal('journal_a2', '2026-08-13'), [journal('journal_future', '2026-08-14')], [review('review_old', '2026-08-10'), review('review_latest', '2026-08-12')]);
    expect(result.journal.id).toBe('journal_a2');
    expect(result.previousReview?.id).toBe('review_latest');
    expect(JSON.stringify(result)).not.toContain('journal_future');
  });
});
