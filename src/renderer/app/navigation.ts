export type AppView = 'start' | 'journal' | 'reviews' | 'projects' | 'settings';

export type NavigationIntent =
  | { type: 'journal.compose' }
  | { type: 'journal.generate-daily' }
  | { type: 'records.journals' }
  | { type: 'review.weekly' }
  | { type: 'review.monthly'; month?: string }
  | { type: 'review.yearly'; year?: string }
  | { type: 'review.coach' }
  | { type: 'review.project'; projectId: string };

export type NavigationTarget = { view: AppView; intent?: NavigationIntent };

export const APP_NAVIGATION: { id: AppView; label: string }[] = [
  { id: 'start', label: '开始' },
  { id: 'journal', label: '日志' },
  { id: 'reviews', label: '复盘' },
  { id: 'projects', label: '项目' },
  { id: 'settings', label: '设置' },
];
