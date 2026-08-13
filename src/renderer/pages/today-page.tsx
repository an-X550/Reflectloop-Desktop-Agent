import { useEffect, useMemo, useRef, useState } from 'react';
import type { Journal, Project, Review } from '../../shared/schemas/domain';
import type { NavigationIntent, NavigationTarget } from '../app/navigation';
import { Button } from '../components/button';
import { EmptyState } from '../components/empty-state';
import { Field } from '../components/field';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { RecordBrowser } from './history-page';
import { toLocalDateString } from '../utils/local-date';

const today = toLocalDateString();
const displayDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${today}T12:00:00`));

export function TodayPage({ journals, projects, reviews, intent, hasApiKey = true, onRefresh, onNavigate }: { journals: Journal[]; projects: Project[]; reviews: Review[]; intent?: NavigationIntent; hasApiKey?: boolean; onRefresh(): Promise<void> | void; onNavigate(target: NavigationTarget): void }) {
  const todayJournal = journals.find((item) => item.date === today);
  const [section, setSection] = useState<'compose' | 'records'>(intent?.type === 'records.journals' ? 'records' : 'compose');
  const [body, setBody] = useState(todayJournal?.body ?? '');
  const [projectId, setProjectId] = useState(todayJournal?.projectIds[0] ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [reviewState, setReviewState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reviewMessage, setReviewMessage] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (intent?.type === 'records.journals') setSection('records');
    if (intent?.type === 'journal.compose' || intent?.type === 'journal.generate-daily') {
      setSection('compose');
      window.setTimeout(() => editorRef.current?.focus(), 0);
    }
  }, [intent]);
  useEffect(() => { if (todayJournal && saveState === 'idle') { setBody(todayJournal.body); setProjectId(todayJournal.projectIds[0] ?? ''); } }, [todayJournal?.id]);

  const weekStart = useMemo(() => { const value = new Date(`${today}T12:00:00`); value.setDate(value.getDate() - ((value.getDay() || 7) - 1)); return value.toISOString().slice(0, 10); }, []);
  const weeklyJournals = journals.filter((item) => item.date >= weekStart && item.date <= today);
  const recent = journals.filter((item) => item.date !== today).slice().reverse().slice(0, 3);

  const save = async () => {
    if (!body.trim()) return null;
    setSaveState('loading'); setSaveMessage('');
    try {
      const saved = await window.zhiji.journals.save({ id: todayJournal?.id, date: today, body, projectIds: projectId ? [projectId] : [] });
      setSaveState('success'); setSaveMessage('已保存到本机'); await onRefresh(); return saved;
    } catch (reason) { setSaveState('error'); setSaveMessage(`保存失败：${reason instanceof Error ? reason.message : '请稍后重试'}`); return null; }
  };
  const generate = async () => {
    setReviewState('loading'); setReviewMessage('正在根据今日日志生成反馈…');
    try {
      const journal = todayJournal ?? await save();
      if (!journal) { setReviewState('error'); setReviewMessage('请先写下并保存今日日志'); return; }
      const result = await window.zhiji.reviews.generateDaily({ journalId: journal.id });
      await onRefresh(); setReviewState('success'); setReviewMessage(result.body);
    } catch (reason) { setReviewState('error'); setReviewMessage(`生成失败：${reason instanceof Error ? reason.message : '请检查 AI 设置'}`); }
  };

  return <>
    {!hasApiKey && <div className="ai-hint"><span>日志可直接保存；配置后还能生成反馈。</span><Button variant="secondary" onClick={() => onNavigate({ view: 'settings' })}>配置 AI</Button></div>}
    <PageHeader title={section === 'compose' ? '写下今天发生的事' : '过去日志'} description={section === 'compose' ? '不用套模板，真实地写就够了。' : '按日期找到过去的原始记录。'} action={<div className="page-tabs"><button className={section === 'compose' ? 'is-active' : ''} onClick={() => setSection('compose')}>今天</button><button className={section === 'records' ? 'is-active' : ''} onClick={() => setSection('records')}>过去日志</button></div>}/>
    {section === 'records' ? <RecordBrowser journals={journals} reviews={reviews} projects={projects} allowedKinds={['journal']}/> : <>
      <div className="today-grid"><section className="card editor-card"><Field label="关联项目（可选）"><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSaveState('idle'); }}><option value="">不关联项目</option>{projects.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="今日日志"><textarea ref={editorRef} aria-label="今日日志" value={body} onChange={(event) => { setBody(event.target.value); setSaveState('idle'); }} placeholder="发生了什么？你做了什么？结果怎样？"/></Field><div className="editor-meta"><span className="tag">{displayDate}</span><span className="tag">{body.length} 字</span></div>{saveMessage && <StatusBanner tone={saveState === 'error' ? 'error' : 'success'}>{saveMessage}</StatusBanner>}<div className="button-row">{hasApiKey && <Button variant="ghost" loading={saveState === 'loading'} disabled={!body.trim()} onClick={() => void save()}>仅保存日志</Button>}<Button variant="primary" loading={hasApiKey ? reviewState === 'loading' : saveState === 'loading'} disabled={!body.trim()} onClick={() => void (hasApiKey ? generate() : save())}>{hasApiKey ? (todayJournal ? '生成今日反馈' : '保存并生成今日反馈') : '保存日志'}</Button></div>{reviewMessage && <StatusBanner tone={reviewState === 'error' ? 'error' : reviewState === 'success' ? 'success' : 'info'}>{reviewMessage}</StatusBanner>}</section>
      <aside className="today-side"><section className="card week-card"><h3>本周记录</h3><p><strong>{weeklyJournals.length}</strong> 篇日志 · <strong>{reviews.filter((item) => item.type === 'daily' && item.periodStart >= weekStart).length}</strong> 次日反馈</p><p className="muted">需要整体回看时，再进入复盘。</p><Button variant="secondary" onClick={() => onNavigate({ view: 'reviews' })}>做复盘</Button></section></aside></div>
      <section className="recent-section"><div className="section-heading"><h3>最近记录</h3><button onClick={() => setSection('records')}>查看全部</button></div>{recent.length ? <div className="recent-list">{recent.map((item) => <article className="recent-item" data-testid="recent-journal" key={item.id}><time>{item.date}</time><span>{item.body.slice(0, 80)}</span></article>)}</div> : <EmptyState title="还没有过去日志" description="保存今天的日志后，它会出现在这里。"/>}</section>
    </>}
  </>;
}
