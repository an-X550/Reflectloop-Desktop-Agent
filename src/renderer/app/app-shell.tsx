import type { ReactNode } from 'react';
import { AgentIcon, HistoryIcon, ProjectsIcon, ReviewsIcon, SettingsIcon, TodayIcon } from '../components/icons';
import { APP_NAVIGATION, type AppView, type NavigationTarget } from './navigation';
const icons = { start: TodayIcon, agent: AgentIcon, journal: HistoryIcon, reviews: ReviewsIcon, projects: ProjectsIcon, settings: SettingsIcon };
export function AppShell({ view, onNavigate, connectionReady, children }: { view: AppView; onNavigate(target: NavigationTarget): void; connectionReady: boolean; children: ReactNode }) {
  const page = APP_NAVIGATION.find((item) => item.id === view)!;
  return <div className="desktop-shell"><aside className="sidebar"><div className="brand">知己<small>LOCAL-FIRST REFLECTION</small></div><nav className="navigation" aria-label="主要导航">{APP_NAVIGATION.map((item) => { const Icon = icons[item.id]; return <button key={item.id} onClick={() => onNavigate({ view: item.id })} aria-current={item.id === view ? 'page' : undefined}><Icon/><span>{item.label}</span></button>; })}</nav><button className="local-data-status" aria-label="本地保存，查看存储位置" onClick={() => onNavigate({ view: 'settings', settingsSection: 'data' })}><strong>本地保存</strong><span>查看存储位置</span></button></aside><main className="workspace"><header className="topbar"><h1>{page.label}</h1><div className={`local-status ${connectionReady ? 'is-ready' : ''}`}><span className="local-status__dot"/>{connectionReady ? 'AI 已配置' : '等待配置 AI'}</div></header><div className="page-view">{children}</div></main></div>;
}
