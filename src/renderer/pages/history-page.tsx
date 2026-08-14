import { useMemo, useState } from 'react';
import type { Journal, Project, Review } from '../../shared/schemas/domain';
import { EmptyState } from '../components/empty-state';
import { buildHistoryItems, HISTORY_KIND_LABELS, type HistoryItem } from '../domain/history-items';
import { HistoryFilter } from '../features/history/history-filter';
import { HistoryReader } from '../features/history/history-reader';

export function RecordBrowser({ journals, reviews = [], projects = [], allowedKinds, onEditJournal, onGenerateDaily, onDelete }: { journals: Journal[]; reviews?: Review[]; projects?: Project[]; allowedKinds: HistoryItem['kind'][]; onEditJournal?(id: string): void; onGenerateDaily?(date: string): void; onDelete?(item: HistoryItem): void }) {
  const items = useMemo(() => buildHistoryItems(journals, reviews, projects).filter((item) => allowedKinds.includes(item.kind)), [journals, reviews, projects, allowedKinds]);
  const [type, setType] = useState('all');
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const filtered = items.filter((item) => (type === 'all' || item.kind === type) && (!projectId || item.projectIds.includes(projectId)) && (!text.trim() || `${item.title}\n${item.body}`.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase())));
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  return <>
    <HistoryFilter type={type} text={text} projectId={projectId} projects={projects} allowedKinds={allowedKinds} onType={setType} onText={setText} onProject={setProjectId}/>
    {filtered.length ? <div className="history-layout"><section className="history-list">{filtered.map((item) => <button key={item.id} className={item.id === selected?.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)} aria-label={`${item.title} ${HISTORY_KIND_LABELS[item.kind]}`}><time>{item.date}</time><div><strong>{item.title}</strong><span>{HISTORY_KIND_LABELS[item.kind]}</span></div></button>)}</section>{selected && <HistoryReader item={selected} onEdit={onEditJournal} onGenerateDaily={onGenerateDaily} onDelete={onDelete}/>}</div> : <EmptyState title="没有符合筛选条件的记录" description="尝试清空搜索词或调整筛选条件。"/>}
  </>;
}
