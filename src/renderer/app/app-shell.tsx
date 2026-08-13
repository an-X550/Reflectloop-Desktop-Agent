import type { ReactNode } from 'react';
import { HistoryIcon, ProjectsIcon, ReviewsIcon, SettingsIcon, TodayIcon } from '../components/icons';
import { APP_NAVIGATION, type AppView } from './navigation';
const icons = { today: TodayIcon, reviews: ReviewsIcon, projects: ProjectsIcon, history: HistoryIcon, settings: SettingsIcon };
export function AppShell({ view, onNavigate, connectionReady, dataPath, children }: { view: AppView; onNavigate(view: AppView): void; connectionReady: boolean; dataPath?: string; children: ReactNode }) {
  const page = APP_NAVIGATION.find((item) => item.id === view)!;
  return <div className="desktop-shell"><aside className="sidebar"><div className="brand">知己<small>LOCAL-FIRST REFLECTION</small></div><nav className="navigation" aria-label="主要导航">{APP_NAVIGATION.map((item) => { const Icon = icons[item.id]; return <button key={item.id} onClick={() => onNavigate(item.id)} aria-current={item.id === view ? 'page' : undefined}><Icon/><span>{item.label}</span></button>; })}</nav><button className="privacy-card" onClick={() => onNavigate('settings')}><strong>数据留在本机</strong><span>{dataPath ?? '查看本地数据位置'}</span></button></aside><main className="workspace"><header className="topbar"><h1>{page.label}</h1><div className={`local-status ${connectionReady ? 'is-ready' : ''}`}><span className="local-status__dot"/>{connectionReady ? 'AI 已配置' : '等待配置 AI'}</div></header><div className="page-view">{children}</div></main></div>;
}
