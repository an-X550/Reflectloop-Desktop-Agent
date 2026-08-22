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
import { ConfirmDialog } from '../components/confirm-dialog';
import { EmptyState } from '../components/empty-state';
import { AgentPage } from '../pages/agent-page';

export function App() {
  const [target, setTarget] = useState<NavigationTarget>({ view: 'start' });
  const [journalDirty, setJournalDirty] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<NavigationTarget | null>(null);
  const data = useAppData();
  if (data.loading) return <div className="boot-state"><span className="spinner"/>正在读取本地数据…</div>;
  if (data.error) return <div className="boot-state"><EmptyState title="暂时无法读取本地数据" description={data.error} action={<Button variant="primary" onClick={() => void data.refresh()}>重试</Button>}/></div>;
  const navigate = (next: NavigationTarget) => {
    if (target.view === 'journal' && journalDirty && next.view !== 'journal') { setPendingTarget(next); return; }
    setTarget(next);
  };
  return <AppShell view={target.view} onNavigate={navigate} connectionReady={data.hasApiKey}>
    {target.view === 'start' ? <StartPage journals={data.journals} reviews={data.reviews} hasApiKey={data.hasApiKey} onNavigate={navigate}/>
      : target.view === 'agent' ? <AgentPage onNavigate={navigate}/>
      : target.view === 'journal' ? <TodayPage journals={data.journals} projects={data.projects} reviews={data.reviews} intent={target.intent} hasApiKey={data.hasApiKey} onRefresh={data.refresh} onNavigate={navigate} onDirtyChange={setJournalDirty}/>
      : target.view === 'reviews' ? <ReviewsPage projects={data.projects.filter((item) => item.status === 'active')} reviews={data.reviews} intent={target.intent} onRefresh={data.refresh}/>
      : target.view === 'projects' ? <ProjectsPage projects={data.projects} journals={data.journals} onRefresh={data.refresh} onNavigate={navigate}/>
      : <SettingsPage initialSection={target.settingsSection} onSaved={data.refresh}/>}
    <ConfirmDialog
      open={pendingTarget !== null}
      title="离开日志编辑？"
      description="这条日志还没有保存，离开后未保存的内容会丢失。"
      confirmLabel="放弃并离开"
      onCancel={() => setPendingTarget(null)}
      onConfirm={() => { if (pendingTarget) setTarget(pendingTarget); setPendingTarget(null); }}
    />
  </AppShell>;
}
