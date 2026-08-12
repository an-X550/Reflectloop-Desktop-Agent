import type { Journal, Review } from '../../shared/schemas/domain';

export function buildDailyContext(journal: Journal, _journals: Journal[], reviews: Review[]) {
  const previousReview = reviews
    .filter((review) => review.type === 'daily' && review.periodEnd < journal.date)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
  return { journal, previousReview };
}
