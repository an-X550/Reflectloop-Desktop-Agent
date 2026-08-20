import { useEffect, useMemo, useRef, useState } from 'react';
import type { Journal, JournalTemplate, Project, Review } from '../../shared/schemas/domain';
import type { NavigationIntent, NavigationTarget } from '../app/navigation';
import { Button } from '../components/button';
import { ConfirmDialog } from '../components/confirm-dialog';
import { EmptyState } from '../components/empty-state';
import { Field } from '../components/field';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { MarkdownDocument } from '../components/markdown-document';
import { RecordBrowser } from './history-page';
import { toLocalDateString } from '../utils/local-date';

const today = toLocalDateString();

const TASK_PHASE_LABELS: Record<string, string> = {
  queued: '排队中…',
  building_context: '正在整理材料…',
  generating: 'AI 正在生成反馈…',
  validating: '正在校验结构…',
  saving: '正在保存到本机…',
};

export function TodayPage({ journals, projects, reviews, intent, hasApiKey = true, onRefresh, onNavigate, onDirtyChange }: { journals: Journal[]; projects: Project[]; reviews: Review[]; intent?: NavigationIntent; hasApiKey?: boolean; onRefresh(): Promise<void> | void; onNavigate(target: NavigationTarget): void; onDirtyChange?(dirty: boolean): void }) {
  const [section, setSection] = useState<'compose' | 'records'>(intent?.type === 'records.journals' ? 'records' : 'compose');
  const [date, setDate] = useState(today);
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState('');
  const [editing, setEditing] = useState<Journal | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [reviewState, setReviewState] = useState<'idle' | 'loading' | 'success' | 'error' | 'info'>('idle');
  const [reviewMessage, setReviewMessage] = useState('');
  const [dailyReviewBody, setDailyReviewBody] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [taskPhase, setTaskPhase] = useState('');
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dirty = Boolean(body.trim()) || Boolean(editing);
  // 未保存时先弹确认框，确认后才执行动作；干净时直接执行
  const guardDiscard = (action: () => void) => { if (dirty) setPendingDiscard(() => action); else action(); };

  useEffect(() => {
    if (intent?.type === 'records.journals') setSection('records');
    if (intent?.type === 'journal.compose' || intent?.type === 'journal.generate-daily') {
      setSection('compose');
      window.setTimeout(() => editorRef.current?.focus(), 0);
    }
  }, [intent]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => window.zhiji.reviews.onTaskPhase((phase) => setTaskPhase(TASK_PHASE_LABELS[phase] ?? '')), []);
  useEffect(() => { void window.zhiji.templates.list().then(setTemplates).catch(() => undefined); }, []);

  const weekStart = useMemo(() => { const value = new Date(`${today}T12:00:00`); value.setDate(value.getDate() - ((value.getDay() || 7) - 1)); return value.toISOString().slice(0, 10); }, []);
  const weeklyJournals = journals.filter((item) => item.date >= weekStart && item.date <= today);
  const recent = journals.filter((item) => item.date !== today).slice().reverse().slice(0, 3);

  const save = async () => {
    if (!body.trim()) return null;
    setSaveState('loading'); setSaveMessage('');
    try {
      const common = { date, body, projectIds: projectId ? [projectId] : [] };
      const saved = editing
        ? await window.zhiji.journals.update({ ...common, id: editing.id, expectedUpdatedAt: editing.updatedAt })
        : await window.zhiji.journals.create(common);
      setSaveState('success'); setSaveMessage('已保存到本机'); setBody(''); setEditing(null); await onRefresh(); return saved;
    } catch (reason) { setSaveState('error'); setSaveMessage(`保存失败：${reason instanceof Error ? reason.message : '请稍后重试'}`); return null; }
  };
  const runDailyReview = async (reviewDate: string, pendingBody: boolean) => {
    setReviewState('loading'); setReviewMessage(''); setDailyReviewBody(null);
    try {
      if (pendingBody) { const journal = await save(); if (!journal) return; }
      const result = await window.zhiji.reviews.generateDaily({ date: reviewDate });
      if (result.kind === 'clarification') { setReviewState('info'); setReviewMessage(result.question); return; }
      await onRefresh(); setReviewState('success'); setReviewMessage('今日反馈已生成'); setDailyReviewBody(result.review.body);
    } catch (reason) { setReviewState('error'); setReviewMessage(`生成失败：${reason instanceof Error ? reason.message : '请检查 AI 设置'}`); }
  };
  const generate = async () => {
    const reviewDate = body.trim() ? date : (journals.some((item) => item.date === today) ? today : null);
    if (!reviewDate) { setReviewState('error'); setReviewMessage('请先写下并保存今日日志'); return; }
    await runDailyReview(reviewDate, Boolean(body.trim()));
  };
  const generateForDate = async (reviewDate: string) => {
    if (!hasApiKey) { onNavigate({ view: 'settings' }); return; }
    await runDailyReview(reviewDate, false);
  };
  const removeJournal = async () => {
    if (!deleteId) return;
    try { await window.zhiji.journals.delete(deleteId); setDeleteId(null); await onRefresh(); }
    catch (reason) { setReviewState('error'); setReviewMessage(`移除失败：${reason instanceof Error ? reason.message : '回收站不可用'}`); }
  };
  const editJournal = (id: string) => guardDiscard(() => {
    const journal = journals.find((item) => item.id === id);
    if (!journal) return;
    setEditing(journal); setDate(journal.date); setBody(journal.body); setProjectId(journal.projectIds[0] ?? '');
    setSection('compose'); setSaveState('idle');
  });

  const canGenerate = hasApiKey && date === today;
  const primaryLabel = canGenerate ? (body.trim() ? '保存并生成今日反馈' : '生成今日反馈') : '保存日志';

  return <>
    {!hasApiKey && <div className="ai-hint"><span>日志可直接保存；配置后还能生成反馈。</span><Button variant="secondary" onClick={() => onNavigate({ view: 'settings' })}>配置 AI</Button></div>}
    <PageHeader
      title={section === 'compose' ? '写一条日志' : '过去日志'}
      description={section === 'compose' ? '选择今天或过去日期，真实地写就够了。' : '按日期找到过去的原始记录。'}
      action={<div className="page-tabs">
        <button className={section === 'compose' ? 'is-active' : ''} onClick={() => setSection('compose')}>写日志</button>
        <button className={section === 'records' ? 'is-active' : ''} onClick={() => guardDiscard(() => setSection('records'))}>过去日志</button>
      </div>}
    />
    {section === 'records' ? <>
      {reviewMessage && <StatusBanner tone={reviewState === 'error' ? 'error' : reviewState === 'success' ? 'success' : 'info'}>{reviewMessage}</StatusBanner>}
      {dailyReviewBody && <article className="card inline-review"><MarkdownDocument>{dailyReviewBody}</MarkdownDocument></article>}
      <RecordBrowser journals={journals} reviews={reviews} projects={projects} allowedKinds={['journal']} onDelete={(item) => { setDeleteId(item.id); setReviewMessage(''); }} onGenerateDaily={(selectedDate) => void generateForDate(selectedDate)} onEditJournal={editJournal}/>
      <ConfirmDialog open={deleteId !== null} title="移除这条日志？" description="已有复盘不会同步删除。" confirmLabel="确认移除" onCancel={() => setDeleteId(null)} onConfirm={() => void removeJournal()}/>
    </> : <>
      <div className="today-grid">
        <section className="card editor-card">
          <Field label="日志日期"><input aria-label="日志日期" type="date" max={today} value={date} onChange={(event) => { setDate(event.target.value); setSaveState('idle'); }}/></Field>
          <Field label="关联项目（可选）"><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSaveState('idle'); }}><option value="">不关联项目</option>{projects.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="日志内容">
            {templates.length > 0 && (
              <div className="editor-meta" style={{ marginBottom: 8 }}>
                <select aria-label="选择模板" value="" onChange={(event) => { if (event.target.value) { const tpl = templates.find((t) => t.name === event.target.value); if (tpl) setBody((old) => (old ? `${old}\n\n${tpl.body}` : tpl.body)); setSaveState('idle'); } event.target.value = ''; }}>
                  <option value="">从模板开始…</option>
                  {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <button type="button" className="reader-actions" style={{ border: 0, background: 'transparent', color: 'var(--accent)', font: 'var(--text-footnote)', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate({ view: 'settings' })}>管理模板</button>
              </div>
            )}
            <textarea ref={editorRef} aria-label="日志内容" value={body} onChange={(event) => { setBody(event.target.value); setSaveState('idle'); }} placeholder={templates.length ? '选择模板或直接开始记录…' : '发生了什么？你做了什么？结果怎样？'}/>
          </Field>
          <div className="editor-meta"><span className="tag">{date === today ? '今天' : date}</span><span className="tag">{body.length} 字</span></div>
          {date < today && <p className="muted">补写历史日志只保存，不会自动生成 AI 反馈。</p>}
          {saveMessage && <StatusBanner tone={saveState === 'error' ? 'error' : 'success'}>{saveMessage}</StatusBanner>}
          <div className="button-row">
            {canGenerate && body.trim() && <Button variant="ghost" loading={saveState === 'loading'} onClick={() => void save()}>仅保存日志</Button>}
            <Button variant="primary" loading={canGenerate ? reviewState === 'loading' : saveState === 'loading'} disabled={!body.trim() && !(canGenerate && journals.some((item) => item.date === today))} onClick={() => void (canGenerate ? generate() : save())}>{primaryLabel}</Button>
          </div>
          {reviewState === 'loading' && <StatusBanner tone="info">{taskPhase || '正在根据日志生成反馈…'}</StatusBanner>}
          {reviewState !== 'loading' && reviewMessage && <StatusBanner tone={reviewState === 'error' ? 'error' : reviewState === 'success' ? 'success' : 'info'}>{reviewMessage}</StatusBanner>}
          {dailyReviewBody && <article className="card inline-review">
            <MarkdownDocument>{dailyReviewBody}</MarkdownDocument>
          </article>}
        </section>
        <aside className="today-side">
          <section className="card week-card">
            <h3>本周记录</h3>
            <p><strong>{weeklyJournals.length}</strong> 篇日志 · <strong>{reviews.filter((item) => item.type === 'daily' && item.periodStart >= weekStart).length}</strong> 次日反馈</p>
            <p className="muted">需要整体回看时，再进入复盘。</p>
            <Button variant="secondary" onClick={() => onNavigate({ view: 'reviews' })}>做复盘</Button>
          </section>
        </aside>
      </div>
      <section className="recent-section">
        <div className="section-heading"><h3>最近记录</h3><button onClick={() => guardDiscard(() => setSection('records'))}>查看全部</button></div>
        {recent.length ? <div className="recent-list">{recent.map((item) => <article className="recent-item" data-testid="recent-journal" key={item.id}><time>{item.date}</time><span>{item.body.slice(0, 80)}</span></article>)}</div> : <EmptyState title="还没有过去日志" description="保存今天的日志后，它会出现在这里。"/>}
      </section>
    </>}
    <ConfirmDialog open={pendingDiscard !== null} title="放弃未保存的内容？" description="这条日志还没有保存，继续操作会丢失未保存的内容。" confirmLabel="放弃" onCancel={() => setPendingDiscard(null)} onConfirm={() => { const action = pendingDiscard; setPendingDiscard(null); action?.(); }}/>
  </>;
}
