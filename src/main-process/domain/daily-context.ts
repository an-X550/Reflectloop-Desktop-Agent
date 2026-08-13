import type { Journal, Review } from '../../shared/schemas/domain';

export function buildDailyContext(journals: Journal[], reviews: Review[]) {
  const date = journals[0]?.date ?? '';
  const previousReview = reviews
    .filter((review) => review.type === 'daily' && review.periodEnd < date)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
  return { journals: journals.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), previousReview };
}
