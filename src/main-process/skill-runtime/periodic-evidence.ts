import type { Journal, Review } from '../../shared/schemas/domain';

export type PeriodicEvidenceGrade = 'A' | 'B' | 'C' | 'D';
export type PeriodicReviewType = 'weekly' | 'monthly' | 'project';

export interface PeriodicEvidence {
  grade: PeriodicEvidenceGrade;
  type: PeriodicReviewType;
  materialCount: { journals: number; dailyReviews: number; weeklyReviews: number };
  gaps: string[];
}

export function buildPeriodicEvidence(
  type: PeriodicReviewType,
  journals: Journal[],
  reviews: Review[],
): PeriodicEvidence {
  const dailyReviews = reviews.filter((r) => r.type === 'daily');
  const weeklyReviews = reviews.filter((r) => r.type === 'weekly');
  const materialCount = {
    journals: journals.length,
    dailyReviews: dailyReviews.length,
    weeklyReviews: weeklyReviews.length,
  };
  const gaps: string[] = [];
  let grade: PeriodicEvidenceGrade;

  if (type === 'weekly') {
    if (materialCount.journals === 0 && materialCount.dailyReviews === 0) {
      grade = 'D';
      gaps.push('缺少可复盘的日志和日反馈');
    } else if (materialCount.dailyReviews === 0) {
      grade = 'C';
      gaps.push('缺少日反馈作为下游沉淀');
    } else if (materialCount.dailyReviews < 3 || materialCount.journals < 3) {
      grade = 'B';
      if (materialCount.dailyReviews < 3) gaps.push('日反馈数量不足以支持完整周复盘');
      if (materialCount.journals < 3) gaps.push('日志数量不足以支持完整周复盘');
    } else {
      grade = 'A';
    }
  } else if (type === 'monthly') {
    if (materialCount.journals === 0 && materialCount.weeklyReviews === 0) {
      grade = 'D';
      gaps.push('缺少可复盘的日志和周复盘');
    } else if (materialCount.weeklyReviews === 0) {
      grade = 'C';
      gaps.push('缺少周复盘作为下游沉淀');
    } else if (materialCount.weeklyReviews < 3) {
      grade = 'B';
      gaps.push('周复盘数量不足以支持完整月复盘');
    } else {
      grade = 'A';
    }
  } else {
    if (materialCount.journals === 0) {
      grade = 'D';
      gaps.push('缺少项目相关日志');
    } else if (materialCount.journals < 2) {
      grade = 'C';
      gaps.push('项目日志数量不足以支撑复盘');
    } else if (materialCount.journals < 3) {
      grade = 'B';
      gaps.push('项目日志数量偏少');
    } else {
      grade = 'A';
    }
  }

  return { grade, type, materialCount, gaps };
}
