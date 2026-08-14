import type { Journal, Review } from '../../shared/schemas/domain';
import type { PeriodicReviewType } from './periodic-evidence';

export interface PeriodicMaterialItem { id: string; date: string; body: string }
export interface PeriodicModelMaterials {
  primary: { kind: 'daily-reviews' | 'weekly-reviews' | 'journals'; items: PeriodicMaterialItem[] };
  supplement: { kind: 'journals'; items: PeriodicMaterialItem[] } | null;
  journalIndex: { id: string; date: string }[];
}

const ENOUGH_DOWNSTREAM = 3;

const toItem = (journal: Journal): PeriodicMaterialItem => ({ id: journal.id, date: journal.date, body: journal.body });
const toReviewItem = (review: Review): PeriodicMaterialItem => ({ id: review.id, date: review.periodStart, body: review.body });

/**
 * 下游沉淀优先：周复盘以日反馈为主材料，月复盘以周复盘为主材料；
 * 原始日志仅在下游沉淀不足时补全文，充足时只保留索引供模型核对日期与引用。
 */
export function buildPeriodicModelMaterials(
  type: PeriodicReviewType,
  journals: Journal[],
  reviews: Review[],
): PeriodicModelMaterials {
  const journalIndex = journals.map((journal) => ({ id: journal.id, date: journal.date }));
  const dailyReviews = reviews.filter((review) => review.type === 'daily');
  const weeklyReviews = reviews.filter((review) => review.type === 'weekly');

  if (type === 'weekly') {
    if (dailyReviews.length === 0) {
      return { primary: { kind: 'journals', items: journals.map(toItem) }, supplement: null, journalIndex };
    }
    return {
      primary: { kind: 'daily-reviews', items: dailyReviews.map(toReviewItem) },
      supplement: dailyReviews.length < ENOUGH_DOWNSTREAM ? { kind: 'journals', items: journals.map(toItem) } : null,
      journalIndex,
    };
  }

  if (type === 'monthly') {
    if (weeklyReviews.length === 0) {
      return { primary: { kind: 'journals', items: journals.map(toItem) }, supplement: null, journalIndex };
    }
    return {
      primary: { kind: 'weekly-reviews', items: weeklyReviews.map(toReviewItem) },
      supplement: weeklyReviews.length < ENOUGH_DOWNSTREAM ? { kind: 'journals', items: journals.map(toItem) } : null,
      journalIndex,
    };
  }

  return { primary: { kind: 'journals', items: journals.map(toItem) }, supplement: null, journalIndex };
}
