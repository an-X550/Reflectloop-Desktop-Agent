import { useMemo, useState } from 'react';
import type { Journal, Project } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { Modal } from '../components/modal';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { ProjectForm } from '../features/projects/project-form';

type Props = { projects: Project[]; journals: Journal[]; onRefresh(): Promise<void> | void; onNavigate(target: NavigationTarget): void };

export function ProjectsPage({ projects, journals, onRefresh, onNavigate }: Props) {
  const [selectedId, setSelectedId] = useState(projects.find((item) => item.status === 'active')?.id ?? projects[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [message, setMessage] = useState('');
  const selected = projects.find((item) => item.id === selectedId) ?? projects[0];
  const linked = useMemo(() => selected ? journals.filter((item) => item.projectIds.includes(selected.id)) : [], [journals, selected?.id]);
  const latest = linked.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  const archive = async () => {
    if (!selected) return;
    try { await window.zhiji.projects.archive(selected.id); setConfirmArchive(false); setMessage('项目已归档，日志保持不变'); await onRefresh(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : '归档失败'); }
  };

  return <>
    <PageHeader title="项目与关联日志" description="把同一目标下的日志放在一起，需要时直接带入项目复盘。" action={<Button variant="primary" onClick={() => setCreating(true)}>新建项目</Button>}/>
    {projects.length ? <div className="project-layout">
      <section className="card project-list">{projects.map((project) => { const count = journals.filter((item) => item.projectIds.includes(project.id)).length; return <button key={project.id} className={project.id === selected?.id ? 'is-active' : ''} onClick={() => { setSelectedId(project.id); setConfirmArchive(false); }}><strong>{project.name}</strong><span>{project.status === 'active' ? '进行中' : '已归档'} · {count} 篇日志</span></button>; })}</section>
      {selected && <section className="card project-detail">
        <div className="section-heading"><div><h3>{selected.name}</h3><span className="tag">{selected.status === 'active' ? '进行中' : '已归档'}</span></div></div>
        <div className="project-metrics"><div><strong>{linked.length} 篇关联日志</strong></div><div><strong>{latest ?? '暂无'}</strong><span>最近活动</span></div></div>
        <p className="muted">{latest ? `最近活动：${latest}` : '还没有关联日志，可在日志页写作时选择此项目。'}</p>
        {message && <StatusBanner tone={message.includes('失败') ? 'error' : 'success'}>{message}</StatusBanner>}
        {selected.status === 'active' && <div className="button-row"><Button variant="secondary" onClick={() => onNavigate({ view: 'reviews', intent: { type: 'review.project', projectId: selected.id } })}>发起项目复盘</Button><Button variant="danger" onClick={() => setConfirmArchive(true)}>归档项目</Button></div>}
        {confirmArchive && <div className="archive-confirm"><p>归档不会删除任何日志。</p><Button variant="ghost" onClick={() => setConfirmArchive(false)}>取消</Button><Button variant="danger" onClick={() => void archive()}>确认归档</Button></div>}
      </section>}
    </div> : <EmptyState
      title="还没有项目"
      description="项目能把同一目标下的日志与复盘材料放在一起。"
      action={<Button variant="primary" onClick={() => setCreating(true)}>新建第一个项目</Button>}
    />}
    <Modal open={creating} title="新建项目" onClose={() => setCreating(false)}><ProjectForm onCancel={() => setCreating(false)} onCreated={async () => { setCreating(false); await onRefresh(); }}/></Modal>
  </>;
}
