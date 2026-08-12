import { useState } from 'react';
import { AppShell } from './app-shell';
import type { AppView } from './navigation';
import { useAppData } from '../hooks/use-app-data';
import { TodayPage } from '../pages/today-page';
import { ReviewsPage } from '../pages/reviews-page';
import { HistoryPage } from '../pages/history-page';
import { SettingsPage } from '../pages/settings-page';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';

export function App() {
  const [view, setView] = useState<AppView>('today');
  const data = useAppData();
  if (data.loading) return <div className="boot-state"><span className="spinner"/>正在读取本地数据…</div>;
  if (data.error) return <div className="boot-state"><EmptyState title="暂时无法读取本地数据" description={data.error} action={<Button variant="primary" onClick={() => void data.refresh()}>重试</Button>}/></div>;
  return <AppShell view={view} onNavigate={setView} connectionReady={Boolean(data.settings?.hasApiKey)}>{view === 'today' ? <TodayPage journals={data.journals} projects={data.projects} reviews={data.reviews} onRefresh={data.refresh} onNavigate={setView}/> : view === 'reviews' ? <ReviewsPage projects={data.projects.filter((item) => item.status === 'active')}/> : view === 'projects' ? <LegacyProjects projects={data.projects} onRefresh={data.refresh}/> : view === 'history' ? <HistoryPage journals={data.journals}/> : <SettingsPage/>}</AppShell>;
}

function LegacyProjects({ projects, onRefresh }: { projects: ReturnType<typeof useAppData>['projects']; onRefresh(): Promise<void> }) {
  const create = async () => { const name = window.prompt('项目名称'); if (name) { await window.zhiji.projects.create({ name }); await onRefresh(); } };
  return <><div className="page-hero"><div><h2>项目与材料</h2><p>日志可在写作时关联项目。</p></div><Button variant="primary" onClick={() => void create()}>新建项目</Button></div><div className="project-grid">{projects.map((project) => <article className="card" key={project.id}><h3>{project.name}</h3><p className="muted">{project.status === 'active' ? '进行中' : '已归档'}</p></article>)}</div></>;
}
