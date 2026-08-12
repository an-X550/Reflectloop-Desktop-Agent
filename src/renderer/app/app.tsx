import { useEffect, useState } from 'react';
import type { Journal, Project } from '../../shared/schemas/domain';
import { SettingsPage } from '../pages/settings-page';

const today = new Date().toISOString().slice(0, 10);

export function App() {
  const [view, setView] = useState<'today' | 'projects' | 'settings'>('today');
  const [projects, setProjects] = useState<Project[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('尚未保存');
  const [reviewStatus, setReviewStatus] = useState('');

  const refresh = async () => {
    setProjects(await window.zhiji.projects.list());
    setJournals(await window.zhiji.journals.list());
  };
  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    if (!body.trim()) return;
    setStatus('正在保存…');
    await window.zhiji.journals.save({ date: today, body, projectIds: projectId ? [projectId] : [] });
    setStatus('已保存到本机');
    await refresh();
  };
  const generateDaily = async () => {
    setReviewStatus('正在生成日反馈…');
    try {
      let journal = journals.find((item) => item.date === today);
      if (!journal && body.trim()) journal = await window.zhiji.journals.save({ date: today, body, projectIds: projectId ? [projectId] : [] });
      if (!journal) { setReviewStatus('请先写下并保存今日日志'); return; }
      await window.zhiji.reviews.generateDaily({ journalId: journal.id });
      setReviewStatus('日反馈已保存到本机');
    } catch (error) { setReviewStatus(`生成失败：${error instanceof Error ? error.message : '请检查设置'}`); }
  };

  const createProject = async () => {
    const name = window.prompt('项目名称');
    if (!name) return;
    await window.zhiji.projects.create({ name });
    await refresh();
  };

  return <div className="app-shell">
    <aside><h1>知己</h1><button onClick={() => setView('today')}>今天</button><button onClick={() => setView('projects')}>项目</button><button onClick={() => setView('settings')}>设置</button><small>数据保存在你的电脑上</small></aside>
    <main>{view === 'today' ? <>
      <header><h2>写下今天发生的事</h2><span>{today}</span></header>
      <section className="card"><label>关联项目（可选）</label><select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">不关联项目</option>{projects.filter((x) => x.status === 'active').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><label>今日日志</label><textarea value={body} onChange={(e) => { setBody(e.target.value); setStatus('尚未保存'); }} placeholder="发生了什么？你做了什么？结果怎样？"/><div className="actions"><span>{status}</span><button className="primary" onClick={() => void save()}>保存日志</button></div></section>
      <section className="card"><h3>今日反馈</h3><p>从今日日志提炼一个洞见和下一步，生成结果经校验后才会保存。</p><div className="actions"><span>{reviewStatus}</span><button onClick={() => void window.zhiji.reviews.cancel()}>取消</button><button className="primary" onClick={() => void generateDaily()}>生成日反馈</button></div></section>
      <section><h3>最近记录</h3>{journals.slice(-5).reverse().map((x) => <article className="row" key={x.id}><b>{x.date}</b><span>{x.body.slice(0, 60)}</span></article>)}</section>
    </> : view === 'projects' ? <><header><h2>项目</h2><button className="primary" onClick={() => void createProject()}>新建项目</button></header><section className="grid">{projects.map((x) => <article className="card" key={x.id}><h3>{x.name}</h3><p>{x.status === 'active' ? '进行中' : '已归档'}</p>{x.status === 'active' && <button onClick={async () => { await window.zhiji.projects.archive(x.id); await refresh(); }}>归档</button>}</article>)}</section></> : <SettingsPage/>}</main>
  </div>;
}
