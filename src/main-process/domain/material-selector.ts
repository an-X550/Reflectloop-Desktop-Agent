import type { Journal, Review } from '../../shared/schemas/domain';

export type Material = (Journal | Review) & { date?: string };
export interface MaterialSelection { type: Review['type']; start: string; end: string; projectId?: string }

export function selectMaterials(input: MaterialSelection, journals: Journal[], reviews: Review[]): Material[] {
  const journalMaterials = journals.filter((journal) => {
    const inRange = journal.date >= input.start && journal.date <= input.end;
    return input.type === 'project' && input.projectId ? inRange && journal.projectIds.includes(input.projectId) : inRange;
  });
  const reviewMaterials = input.type === 'weekly'
    ? reviews.filter((review) => review.type === 'daily' && review.periodStart >= input.start && review.periodEnd <= input.end)
    : input.type === 'monthly'
      ? reviews.filter((review) => review.type === 'weekly' && review.periodStart >= input.start && review.periodEnd <= input.end)
      : [];
  return [...new Map([...journalMaterials, ...reviewMaterials].map((item) => [item.id, item])).values()]
    .sort((a, b) => ('date' in a ? a.date : a.periodStart).localeCompare('date' in b ? b.date : b.periodStart));
}
