import { useEffect, useMemo, useState } from 'react';
import type { AgentSession } from '../../shared/schemas/agent';
import { AgentPresentationCardSchema, type AgentPresentationCard, type AgentWorkflowApproval } from '../../shared/schemas/agent-tools';
import { Button } from '../components/button';
import { MarkdownDocument } from '../components/markdown-document';
import { PageHeader } from '../components/page-header';
import { StatusBanner } from '../components/status-banner';
import { agentNavigationTarget, type NavigationTarget } from '../app/navigation';

export function AgentPage({ onNavigate = () => undefined }: { onNavigate?: (target: NavigationTarget) => void }) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [stream, setStream] = useState<{ sessionId: string; messageId: string; content: string } | null>(null);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState<Array<{ id: string; label: string; phase: 'started' | 'completed' | 'failed' }>>([]);
  const [cards, setCards] = useState<AgentPresentationCard[]>([]);
  const [approvals, setApprovals] = useState<Array<{ sessionId: string; approval: AgentWorkflowApproval }>>([]);

  useEffect(() => {
    void window.zhiji.agent.list().then((items) => {
      setSessions(items);
      setSelectedId((current) => current ?? items[0]?.id ?? null);
    }).catch(() => setError('无法读取 Agent 会话，请重试。'));
    return window.zhiji.agent.onEvent((event) => {
      if (event.type === 'session.updated') {
        setSessions((items) => [event.session, ...items.filter((item) => item.id !== event.session.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
        setSelectedId((current) => current ?? event.session.id);
      }
      if (event.type === 'message.delta') setStream((current) => current?.messageId === event.messageId ? { ...current, content: current.content + event.delta } : { sessionId: event.sessionId, messageId: event.messageId, content: event.delta });
      if (event.type === 'message.completed') setStream((current) => current?.messageId === event.message.id ? null : current);
      if (event.type === 'tool.activity') setActivities((items) => [{ id: event.callId, label: event.label, phase: event.phase }, ...items.filter((item) => item.id !== event.callId)].slice(0, 8));
      if (event.type === 'ui.navigate') {
        const target = agentNavigationTarget(event.target);
        if (target) onNavigate(target);
        else setError('Agent 请求的页面无效，已拒绝打开。');
      }
      if (event.type === 'ui.present') {
        const card = AgentPresentationCardSchema.safeParse(event.card);
        if (card.success) setCards((items) => [card.data, ...items].slice(0, 6));
        else setError('Agent 请求的结果卡片无效，已拒绝展示。');
      }
      if (event.type === 'workflow.approval') setApprovals((items) => [{ sessionId: event.sessionId, approval: event.approval }, ...items.filter((item) => item.approval.approvalId !== event.approval.approvalId)].slice(0, 6));
      if (event.type === 'error') setError(event.message);
    });
  }, []);

  const selected = useMemo(() => sessions.find((item) => item.id === selectedId) ?? null, [selectedId, sessions]);
  const createSession = async (): Promise<AgentSession | null> => {
    try {
      setError('');
      const session = await window.zhiji.agent.start();
      setSelectedId(session.id);
      return session;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法启动知己 Agent。');
      return null;
    }
  };
  const send = async () => {
    const content = message.trim();
    if (!content) return;
    const session = selected ?? await createSession();
    if (!session) return;
    setMessage('');
    setError('');
    try { await window.zhiji.agent.send({ sessionId: session.id, message: content }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '发送失败，请重试。'); }
  };
  const stop = async () => {
    if (!selected) return;
    try { await window.zhiji.agent.cancel({ sessionId: selected.id }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '无法停止当前任务。'); }
  };
  const confirmApproval = async (item: { sessionId: string; approval: AgentWorkflowApproval }) => {
    try {
      setError('');
      await window.zhiji.agent.confirm({ sessionId: item.sessionId, approvalId: item.approval.approvalId });
      setApprovals((items) => items.filter((current) => current.approval.approvalId !== item.approval.approvalId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '确认失败，请重新预览材料。'); }
  };

  return <div className="agent-page">
    <PageHeader title="知己 Agent" description="用自然语言组织目标；已有日志与复盘能力会继续沿用原有的校验和确认流程。" action={<Button variant="secondary" onClick={() => void createSession()}>新建会话</Button>}/>
    <div className="agent-layout">
      <aside className="agent-sessions card" aria-label="Agent 会话列表">
        <h3>会话</h3>
        {sessions.length === 0 && <p className="muted">新建会话后，开始描述你想完成的目标。</p>}
        <div className="agent-session-list">{sessions.map((session) => <button key={session.id} className={session.id === selectedId ? 'is-active' : ''} onClick={() => { setSelectedId(session.id); setError(''); }}><strong>{session.title}</strong><span>{session.status === 'running' ? '正在处理…' : session.status === 'failed' ? '运行已停止' : '等待继续'}</span></button>)}</div>
      </aside>
      <section className="agent-conversation card">
        {!selected && <div className="agent-empty"><h3>从一个目标开始</h3><p>例如：帮我梳理本周值得复盘的问题。</p><Button variant="primary" onClick={() => void createSession()}>开始对话</Button></div>}
        {selected && <>
          <div className="agent-conversation__header"><div><h3>{selected.title}</h3><span className="muted">{selected.status === 'running' ? 'Agent 正在思考与组织回复' : selected.status === 'failed' ? '运行已停止，可新建会话继续' : '可以继续输入'}</span></div>{selected.status === 'running' && <Button variant="ghost" onClick={() => void stop()}>停止</Button>}</div>
          <div className="agent-messages">{selected.messages.map((item) => <article key={item.id} className={`agent-message agent-message--${item.role}`}><strong>{item.role === 'user' ? '你' : '知己 Agent'}</strong>{item.role === 'assistant' ? <MarkdownDocument>{item.content}</MarkdownDocument> : <p>{item.content}</p>}</article>)}
            {stream?.sessionId === selected.id && <article className="agent-message agent-message--assistant"><strong>知己 Agent</strong><MarkdownDocument>{stream.content}</MarkdownDocument><span className="stream-caret" aria-hidden="true"/></article>}
          </div>
          {(activities.length > 0 || cards.length > 0 || approvals.some((item) => item.sessionId === selected.id)) && <section className="agent-tool-results" aria-label="Agent 工具活动">
            {activities.map((item) => <p key={item.id} className={`agent-tool-results__activity agent-tool-results__activity--${item.phase}`}>{item.phase === 'started' ? '正在' : item.phase === 'completed' ? '已完成' : '未完成'}：{item.label}</p>)}
            {approvals.filter((item) => item.sessionId === selected.id).map((item) => <article className="agent-result-card" key={item.approval.approvalId}><h4>{item.approval.title}</h4><p>{item.approval.summary}</p><p className="muted">材料：{item.approval.preview.sources.length} 条；确认后才会写入正式复盘。</p><ul>{item.approval.preview.sources.slice(0, 8).map((source) => <li key={source.id}>{source.date}：{source.excerpt}</li>)}</ul><Button variant="primary" disabled={selected.status === 'running'} onClick={() => void confirmApproval(item)}>确认并继续</Button></article>)}
            {cards.map((card, index) => <article className="agent-result-card" key={`${card.title}-${index}`}><h4>{card.title}</h4><p>{card.summary}</p><div>{card.links.map((link, linkIndex) => <Button key={`${link.label}-${linkIndex}`} variant="secondary" onClick={() => { const target = agentNavigationTarget(link.target); if (target) onNavigate(target); else setError('结果链接无效，已拒绝打开。'); }}>{link.label}</Button>)}</div></article>)}
          </section>}
          <div className="agent-composer"><textarea aria-label="向知己 Agent 发送消息" value={message} rows={3} placeholder="描述你的目标、补充材料或继续追问…" disabled={selected.status === 'running'} onChange={(event) => setMessage(event.target.value)}/><Button variant="primary" disabled={!message.trim() || selected.status === 'running'} onClick={() => void send()}>发送</Button></div>
        </>}
      </section>
    </div>
    {error && <StatusBanner tone="error">{error}</StatusBanner>}
  </div>;
}
