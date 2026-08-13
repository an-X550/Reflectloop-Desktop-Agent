import type { Journal, Review } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';
import { toLocalDateString } from '../utils/local-date';

export type NextStep = {
  kind: 'write-journal' | 'generate-daily' | 'weekly-review' | 'recent-records';
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
  return { kind: 'recent-records', title: '查看最近记录', reason: '今天的记录与反馈已经完成。', target: { view: 'journal', intent: { type: 'records.journals' } } };
}
