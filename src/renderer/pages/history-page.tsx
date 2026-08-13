import { useMemo, useState } from 'react';
import type { Journal, Project, Review } from '../../shared/schemas/domain';
import { EmptyState } from '../components/empty-state';
import { buildHistoryItems, type HistoryItem } from '../domain/history-items';
import { HistoryFilter } from '../features/history/history-filter';
import { HistoryReader } from '../features/history/history-reader';

const labels: Record<HistoryItem['kind'], string> = { journal: '日志', daily: '日反馈', weekly: '周报', monthly: '月报', project: '项目复盘' };

export function RecordBrowser({ journals, reviews = [], projects = [], allowedKinds, onEditJournal, onGenerateDaily }: { journals: Journal[]; reviews?: Review[]; projects?: Project[]; allowedKinds: HistoryItem['kind'][]; onEditJournal?(id: string): void; onGenerateDaily?(date: string): void }) {
  const items = useMemo(() => buildHistoryItems(journals, reviews, projects).filter((item) => allowedKinds.includes(item.kind)), [journals, reviews, projects, allowedKinds]);
  const [type, setType] = useState('all');
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const filtered = items.filter((item) => (type === 'all' || item.kind === type) && (!projectId || item.projectIds.includes(projectId)) && (!text.trim() || `${item.title}\n${item.body}`.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase())));
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  return <>
    <HistoryFilter type={type} text={text} projectId={projectId} projects={projects} allowedKinds={allowedKinds} onType={setType} onText={setText} onProject={setProjectId}/>
    {filtered.length ? <div className="history-layout"><section className="history-list">{filtered.map((item) => <button key={item.id} className={item.id === selected?.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)} aria-label={`${item.title} ${labels[item.kind]}`}><time>{item.date}</time><div><strong>{item.title}</strong><span>{labels[item.kind]}</span></div></button>)}</section>{selected && <HistoryReader item={selected} onEdit={onEditJournal} onGenerateDaily={onGenerateDaily}/>}</div> : <EmptyState title="没有符合筛选条件的记录" description="尝试清空搜索词或调整筛选条件。"/>}
  </>;
}
