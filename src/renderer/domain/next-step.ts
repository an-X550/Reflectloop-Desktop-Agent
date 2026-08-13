import type { Journal, Review } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';
import { toLocalDateString } from '../utils/local-date';

export type NextStep = {
  kind: 'write-journal' | 'generate-daily' | 'weekly-review' | 'monthly-review' | 'yearly-review' | 'coach-review' | 'recent-records';
  title: string;
  reason: string;
  target: NavigationTarget;
};

function isoDateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return toLocalDateString(value);
}

export function resolveNextStep({ today, dayOfWeek, journals, reviews }: { today: string; dayOfWeek: number; journals: Journal[]; reviews: Review[] }): NextStep {
  const todayJournals = journals.filter((item) => item.date === today);
  if (!todayJournals.length) return { kind: 'write-journal', title: '写下今天的经历', reason: '今天还没有记录。一段真实经历就够了。', target: { view: 'journal', intent: { type: 'journal.compose' } } };

  const sourceVersions = todayJournals.map(({ id, updatedAt }) => ({ id, updatedAt })).sort((a, b) => a.id.localeCompare(b.id));
  const hasDailyReview = reviews.some((item) => item.schemaVersion === 2 && item.type === 'daily' && item.periodEnd === today
    && JSON.stringify(item.sourceVersions.slice().sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify(sourceVersions));
  if (!hasDailyReview) return { kind: 'generate-daily', title: '生成今日反馈', reason: '今天的日志已保存，还差一次反馈。', target: { view: 'journal', intent: { type: 'journal.generate-daily' } } };

  const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const weekStart = isoDateOffset(today, 1 - normalizedDay);
  const weekEnd = isoDateOffset(today, 7 - normalizedDay);
  const weeklyJournalCount = journals.filter((item) => item.date >= weekStart && item.date <= weekEnd).length;
  const hasCurrentWeeklyReview = reviews.some((item) => item.type === 'weekly' && item.periodStart <= weekStart && item.periodEnd >= weekEnd);
  if ((dayOfWeek === 0 || dayOfWeek === 6) && weeklyJournalCount >= 3 && !hasCurrentWeeklyReview) {
    return { kind: 'weekly-review', title: '做本周复盘', reason: `本周已有 ${weeklyJournalCount} 篇日志，可以一起回看。`, target: { view: 'reviews', intent: { type: 'review.weekly' } } };
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const previousYear = String(year - 1);
  const previousYearMonths = reviews.filter((item) => item.type === 'monthly' && item.periodStart.startsWith(previousYear));
  const hasPreviousYearReview = reviews.some((item) => item.type === 'yearly' && item.periodStart.startsWith(previousYear));
  if (month === 1 && day <= 14 && previousYearMonths.length >= 6 && !hasPreviousYearReview) {
    return { kind: 'yearly-review', title: '回看上一年', reason: `已有 ${previousYearMonths.length} 份月度复盘，足以形成年度主线。`, target: { view: 'reviews', intent: { type: 'review.yearly', year: previousYear } } };
  }
  const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const previousMonth = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const previousMonthWeeks = reviews.filter((item) => item.type === 'weekly' && item.periodStart.startsWith(previousMonth));
  const hasPreviousMonthReview = reviews.some((item) => item.type === 'monthly' && item.periodStart.startsWith(previousMonth));
  if (day <= 3 && previousMonthWeeks.length >= 2 && !hasPreviousMonthReview) {
    return { kind: 'monthly-review', title: '做上月复盘', reason: `上月已有 ${previousMonthWeeks.length} 份周复盘，可以看见跨周变化。`, target: { view: 'reviews', intent: { type: 'review.monthly', month: previousMonth } } };
  }
  const recentStart = isoDateOffset(today, -29);
  const recentJournals = journals.filter((item) => item.date >= recentStart && item.date <= today);
  const hasRecentCoach = reviews.some((item) => item.type === 'coach' && item.periodEnd >= recentStart);
  if (recentJournals.length >= 7 && !hasRecentCoach) {
    return { kind: 'coach-review', title: '检查日志质量', reason: '近期记录已足够，可以用一次检查让之后的分析更准确。', target: { view: 'reviews', intent: { type: 'review.coach' } } };
  }
  return { kind: 'recent-records', title: '查看最近记录', reason: '今天的记录与反馈已经完成。', target: { view: 'journal', intent: { type: 'records.journals' } } };
}
