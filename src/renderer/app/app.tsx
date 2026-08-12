import { useState } from 'react';
import { AppShell } from './app-shell';
import type { AppView } from './navigation';
import { useAppData } from '../hooks/use-app-data';
import { TodayPage } from '../pages/today-page';
import { ReviewsPage } from '../pages/reviews-page';
import { HistoryPage } from '../pages/history-page';
import { SettingsPage } from '../pages/settings-page';
import { ProjectsPage } from '../pages/projects-page';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';

export function App() {
  const [view, setView] = useState<AppView>('today');
  const data = useAppData();
  if (data.loading) return <div className="boot-state"><span className="spinner"/>正在读取本地数据…</div>;
  if (data.error) return <div className="boot-state"><EmptyState title="暂时无法读取本地数据" description={data.error} action={<Button variant="primary" onClick={() => void data.refresh()}>重试</Button>}/></div>;
  return <AppShell view={view} onNavigate={setView} connectionReady={Boolean(data.settings?.hasApiKey)}>{view === 'today' ? <TodayPage journals={data.journals} projects={data.projects} reviews={data.reviews} onRefresh={data.refresh} onNavigate={setView}/> : view === 'reviews' ? <ReviewsPage projects={data.projects.filter((item) => item.status === 'active')} onNavigate={setView}/> : view === 'projects' ? <ProjectsPage projects={data.projects} journals={data.journals} onRefresh={data.refresh} onNavigate={setView}/> : view === 'history' ? <HistoryPage journals={data.journals} reviews={data.reviews} projects={data.projects}/> : <SettingsPage onSaved={data.refresh}/>}</AppShell>;
}
