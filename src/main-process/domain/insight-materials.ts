import { appError } from '../../shared/errors/app-error';
import type { Journal, Review } from '../../shared/schemas/domain';
import type { InsightReviewPreviewInput } from '../../shared/schemas/ipc';

export type InsightMaterial = Journal | Review;

const inJournalRange = (item: Journal, start: string, end: string) => item.date >= start && item.date <= end;
const inReviewRange = (item: Review, start: string, end: string) => item.periodStart >= start && item.periodEnd <= end;

export function selectInsightMaterials(input: InsightReviewPreviewInput, journals: Journal[], reviews: Review[]): InsightMaterial[] {
  if (input.type === 'coach') {
    const selected = journals.filter((item) => inJournalRange(item, input.start, input.end)).sort((a, b) => a.date.localeCompare(b.date));
    if (selected.length < 3) throw appError({ code: 'INVALID_INPUT', message: `范围内仅找到 ${selected.length} 篇日志条目。至少需要3篇才能做有意义的教练分析。` });
    return selected.slice(-40);
  }

  if (input.type === 'yearly') {
    const selected = reviews.filter((item) => item.type === 'monthly' && inReviewRange(item, input.start, input.end)).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    if (selected.length < 6) throw appError({ code: 'INVALID_INPUT', message: '年度回顾至少需要 6 份月度复盘。' });
    return selected;
  }

  const rank: Partial<Record<Review['type'], number>> = { monthly: 0, weekly: 1, daily: 2 };
  const selectedReviews = reviews
    .filter((item) => rank[item.type] !== undefined && inReviewRange(item, input.start, input.end))
    .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || b.periodStart.localeCompare(a.periodStart));
  const selectedJournals = journals.filter((item) => inJournalRange(item, input.start, input.end)).sort((a, b) => b.date.localeCompare(a.date));
  const selected = [...selectedReviews, ...selectedJournals].slice(0, 40);
  if (!selected.length) throw appError({ code: 'INVALID_INPUT', message: '所选范围内没有可用于方向校准的材料。' });
  return selected;
}
