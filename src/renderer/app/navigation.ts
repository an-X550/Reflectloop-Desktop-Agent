export type AppView = 'today' | 'reviews' | 'projects' | 'history' | 'settings';

export const APP_NAVIGATION: { id: AppView; label: string }[] = [
  { id: 'today', label: '今天' },
  { id: 'reviews', label: '复盘' },
  { id: 'projects', label: '项目' },
  { id: 'history', label: '历史' },
  { id: 'settings', label: '设置' },
];
