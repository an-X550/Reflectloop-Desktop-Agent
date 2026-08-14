import { useCallback, useEffect, useState } from 'react';
import type { TopicIndexEntry, TopicMessage, TopicSession, WebSearchResult, WebSourceContent } from '../../shared/schemas/domain';
import type { NavigationIntent } from '../app/navigation';
import { Button } from '../components/button';
import { MarkdownDocument } from '../components/markdown-document';
import { StatusBanner } from '../components/status-banner';

type TopicProposal = Awaited<ReturnType<typeof window.zhiji.topics.propose>>;

interface ActiveDiscussion {
  sessionId: string;
  question: string;
  referencedTopics: { topic: string; title: string }[];
  messages: TopicMessage[];
}

const errorMessage = (prefix: string) => (reason: unknown) => `${prefix}${reason instanceof Error ? reason.message : '请稍后重试'}`;

/**
 * 主题思考页：讨论 → 展示差异 → 用户确认 → 沉淀。
 * 未完成会话走文件型 checkpoint，可随时恢复；联网搜索只能由用户显式触发。
 */
export function TopicsPage({ intent }: { intent?: NavigationIntent }) {
  const [entries, setEntries] = useState<TopicIndexEntry[]>([]);
  const [sessions, setSessions] = useState<TopicSession[]>([]);
  const [openTopic, setOpenTopic] = useState<{ topic: string; body: string } | null>(null);
  const [discussion, setDiscussion] = useState<ActiveDiscussion | null>(null);
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState('');
  const [proposal, setProposal] = useState<TopicProposal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [search, setSearch] = useState<{ searchSessionId: string; results: WebSearchResult[] } | null>(null);
  const [source, setSource] = useState<WebSourceContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [contextExcerpt, setContextExcerpt] = useState<string | null>(null);

  useEffect(() => {
    if (intent?.type === 'topics.start') {
      setQuestion(intent.question ?? '');
      setContextExcerpt(intent.contextExcerpt ?? null);
    }
  }, [intent]);

  const refresh = useCallback(async () => {
    const [nextEntries, nextSessions] = await Promise.all([window.zhiji.topics.list(), window.zhiji.topics.sessions()]);
    setEntries(nextEntries);
    setSessions(nextSessions);
  }, []);
  useEffect(() => { refresh().catch((reason) => setBanner({ tone: 'error', text: errorMessage('无法读取主题数据：')(reason) })); }, [refresh]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setBanner(null);
    try { await task(); }
    catch (reason) { setBanner({ tone: 'error', text: reason instanceof Error ? reason.message : '请稍后重试' }); }
    finally { setBusy(false); }
  };

  const start = () => run(async () => {
    const next = await window.zhiji.topics.start({ question: question.trim(), ...(contextExcerpt ? { contextExcerpt } : {}) });
    setDiscussion({ sessionId: next.sessionId, question: question.trim(), referencedTopics: next.referencedTopics, messages: [
      { role: 'user', content: question.trim(), at: new Date().toISOString() },
      { role: 'assistant', content: next.draft, at: new Date().toISOString() },
    ] });
    setProposal(null); setQuestion(''); setContextExcerpt(null);
    await refresh();
  });

  const send = () => run(async () => {
    if (!discussion) return;
    const text = message.trim();
    setDiscussion({ ...discussion, messages: [...discussion.messages, { role: 'user', content: text, at: new Date().toISOString() }] });
    setMessage('');
    const { reply } = await window.zhiji.topics.discuss({ sessionId: discussion.sessionId, message: text });
    setDiscussion((old) => old ? { ...old, messages: [...old.messages, { role: 'assistant', content: reply, at: new Date().toISOString() }] } : old);
    setProposal(null);
  });

  const resume = (sessionId: string) => run(async () => {
    const next = await window.zhiji.topics.resume({ sessionId });
    setDiscussion({ sessionId: next.id, question: next.question, referencedTopics: [], messages: next.messages });
    setProposal(null);
  });

  const propose = () => run(async () => {
    if (!discussion) return;
    setProposal(await window.zhiji.topics.propose({ sessionId: discussion.sessionId }));
  });

  const confirm = () => run(async () => {
    if (!discussion) return;
    const { topic } = await window.zhiji.topics.confirm({ sessionId: discussion.sessionId });
    setBanner({ tone: 'success', text: `已沉淀到主题《${topic}》。` });
    setDiscussion(null); setProposal(null);
    await refresh();
  });

  const searchWeb = () => run(async () => {
    setSearch(await window.zhiji.web.search({ query: searchQuery.trim() }));
    setSource(null);
  });

  const readSource = (result: WebSearchResult) => run(async () => {
    if (!search) return;
    setSource(await window.zhiji.web.readSource({ searchSessionId: search.searchSessionId, sourceId: result.sourceId }));
  });

  return <div className="page-content topics-page">
    <section className="card">
      <h3>开始一场主题讨论</h3>
      <p className="muted">把你的长期困惑、既有观点或价值判断交给 AI 讨论；未经你确认，任何内容都不会写入主题文件。</p>
      {contextExcerpt && <p className="muted">已带入来源页的摘录作为讨论背景，会随首问一起提交。</p>}
      <div className="form-row">
        <textarea aria-label="主题问题" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：化债周期下我该选什么行业？" rows={3}/>
      </div>
      <div className="button-row">
        <Button variant="primary" loading={busy} disabled={!question.trim()} onClick={() => void start()}>开始讨论</Button>
      </div>
      {sessions.length > 0 && <div className="topic-sessions">
        <h4>未完成的讨论（可恢复）</h4>
        <ul>{sessions.map((session) => <li key={session.id}>
          <button onClick={() => void resume(session.id)}>{session.question.slice(0, 60)}</button>
          <span className="muted">{session.updatedAt.slice(0, 10)}</span>
        </li>)}</ul>
      </div>}
    </section>

    {discussion && <section className="card topic-discussion">
      <h3>讨论中：{discussion.question}</h3>
      {discussion.referencedTopics.length > 0 && <p className="muted">参考了既有主题：{discussion.referencedTopics.map((item) => item.title).join('、')}</p>}
      <div className="topic-messages">
        {discussion.messages.map((item, index) => <div key={`${item.role}-${index}`} className={`topic-message topic-message--${item.role}`}>
          <strong>{item.role === 'user' ? '你' : 'AI'}</strong>
          {item.role === 'assistant' ? <MarkdownDocument>{item.content}</MarkdownDocument> : <p>{item.content}</p>}
        </div>)}
      </div>
      <div className="form-row">
        <textarea aria-label="继续讨论" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="带来新信息、反例或追问…" rows={3}/>
      </div>
      <div className="button-row">
        <Button variant="primary" loading={busy} disabled={!message.trim()} onClick={() => void send()}>继续讨论</Button>
        <Button variant="ghost" loading={busy} onClick={() => void propose()}>生成主题归纳</Button>
        {proposal && <Button variant="primary" loading={busy} onClick={() => void confirm()}>确认沉淀</Button>}
      </div>
      {proposal && <div className="topic-proposal">
        <h4>{proposal.mode === 'update' ? `更新既有主题：${proposal.targetTopic}` : '新建主题'}《{proposal.summary.title}》</h4>
        <p className="muted">核心问题：{proposal.summary.coreQuestion}</p>
        {proposal.mode === 'update' && <details><summary>合并前的既有正文</summary><MarkdownDocument>{proposal.existingBody ?? ''}</MarkdownDocument></details>}
        <p className="muted">{proposal.mode === 'update' ? '以下为重组后的完整正文（已合并既有认识与本轮讨论）：' : '以下为归纳出的正文：'}</p>
        <MarkdownDocument>{proposal.summary.body}</MarkdownDocument>
        <p className="muted">确认沉淀后才会写入主题文件；不确认则只保留讨论记录。</p>
      </div>}
    </section>}

    <section className="card">
      <h3>受控联网搜索</h3>
      <p className="muted">仅在你点击搜索时发起网络请求；结果显示来源与检索日期，AI 无法自行访问任意网址。</p>
      <div className="form-row">
        <input aria-label="搜索关键词" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索关键词…"/>
        <Button variant="ghost" loading={busy} disabled={!searchQuery.trim()} onClick={() => void searchWeb()}>搜索</Button>
      </div>
      {search && search.results.length === 0 && <p className="muted">没有找到相关结果。</p>}
      {search && search.results.length > 0 && <ul className="web-results">
        {search.results.map((result) => <li key={result.sourceId}>
          <strong>{result.title}</strong>
          <span className="muted">来源 {new URL(result.url).hostname} · 检索于 {result.retrievedAt.slice(0, 10)}{result.publishedAt ? ` · 发布于 ${result.publishedAt}` : ''}</span>
          {result.snippet && <p>{result.snippet}</p>}
          <Button variant="ghost" loading={busy} onClick={() => void readSource(result)}>阅读原文</Button>
        </li>)}
      </ul>}
      {source && <div className="web-source">
        <h4>{source.title}</h4>
        <span className="muted">{source.url}{source.publishedAt ? ` · 发布于 ${source.publishedAt}` : ''}</span>
        <MarkdownDocument>{source.excerpt}</MarkdownDocument>
      </div>}
    </section>

    <section className="card">
      <h3>已沉淀主题</h3>
      {entries.length === 0 && <p className="muted">还没有沉淀过主题。</p>}
      {entries.length > 0 && <ul className="topic-index">
        {entries.map((entry) => <li key={entry.topic}>
          <button onClick={() => void run(async () => { setOpenTopic(openTopic?.topic === entry.topic ? null : await window.zhiji.topics.get({ topic: entry.topic })); })}>
            {entry.title}
          </button>
          <span className="muted">{entry.coreQuestion} · 更新于 {entry.updatedAt.slice(0, 10)}</span>
          {openTopic?.topic === entry.topic && <MarkdownDocument>{openTopic.body}</MarkdownDocument>}
        </li>)}
      </ul>}
    </section>

    {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
  </div>;
}
