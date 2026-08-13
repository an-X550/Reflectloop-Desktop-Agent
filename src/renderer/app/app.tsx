import { useState } from 'react';
import { AppShell } from './app-shell';
import type { NavigationTarget } from './navigation';
import { useAppData } from '../hooks/use-app-data';
import { TodayPage } from '../pages/today-page';
import { ReviewsPage } from '../pages/reviews-page';
import { SettingsPage } from '../pages/settings-page';
import { ProjectsPage } from '../pages/projects-page';
import { StartPage } from '../pages/start-page';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';

export function App() {
  const [target, setTarget] = useState<NavigationTarget>({ view: 'start' });
  const data = useAppData();
  if (data.loading) return <div className="boot-state"><span className="spinner"/>正在读取本地数据…</div>;
  if (data.error) return <div className="boot-state"><EmptyState title="暂时无法读取本地数据" description={data.error} action={<Button variant="primary" onClick={() => void data.refresh()}>重试</Button>}/></div>;
  const navigate = (next: NavigationTarget) => setTarget(next);
  return <AppShell view={target.view} onNavigate={navigate} connectionReady={Boolean(data.settings?.hasApiKey)} dataPath={data.dataDirectory?.path}>
    {target.view === 'start' ? <StartPage journals={data.journals} reviews={data.reviews} hasApiKey={Boolean(data.settings?.hasApiKey)} onNavigate={navigate}/>
      : target.view === 'journal' ? <TodayPage journals={data.journals} projects={data.projects} reviews={data.reviews} intent={target.intent} hasApiKey={Boolean(data.settings?.hasApiKey)} onRefresh={data.refresh} onNavigate={navigate}/>
      : target.view === 'reviews' ? <ReviewsPage projects={data.projects.filter((item) => item.status === 'active')} reviews={data.reviews} intent={target.intent} onNavigate={navigate}/>
      : target.view === 'projects' ? <ProjectsPage projects={data.projects} journals={data.journals} onRefresh={data.refresh} onNavigate={(view) => navigate({ view })}/>
      : <SettingsPage onSaved={data.refresh}/>} 
  </AppShell>;
}
