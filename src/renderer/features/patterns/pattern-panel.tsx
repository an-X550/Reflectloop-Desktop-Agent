import { useCallback, useEffect, useState } from 'react';
import type { Review, VerifiedPattern, VerifiedPatternCandidate } from '../../../shared/schemas/domain';
import { Button } from '../../components/button';
import { StatusBanner } from '../../components/status-banner';

/**
 * 验证模式面板：模型只能提出候选，用户确认后才写入本地快照；拒绝不产生任何持久化。
 */
export function PatternPanel({ review }: { review: Review }) {
  const [confirmed, setConfirmed] = useState<VerifiedPattern[]>([]);
  const [candidates, setCandidates] = useState<VerifiedPatternCandidate[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try { setConfirmed(await window.zhiji.patterns.list()); }
    catch (reason) { setState('error'); setMessage(`无法读取已确认模式：${reason instanceof Error ? reason.message : '请稍后重试'}`); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const propose = async () => {
    setState('loading'); setMessage('');
    try {
      const next = await window.zhiji.patterns.propose({ reviewId: review.id });
      setCandidates(next);
      setState('idle');
      if (!next.length) setMessage('这条复盘中没有值得验证的候选。');
    } catch (reason) { setState('error'); setMessage(`提取失败：${reason instanceof Error ? reason.message : '请检查 AI 设置'}`); }
  };
  const confirm = async (candidate: VerifiedPatternCandidate) => {
    setState('loading'); setMessage('');
    try {
      await window.zhiji.patterns.confirm(candidate);
      setCandidates((old) => old.filter((item) => item !== candidate));
      await refresh();
      setState('idle'); setMessage('已沉淀为验证模式。');
    } catch (reason) { setState('error'); setMessage(`沉淀失败：${reason instanceof Error ? reason.message : '请稍后重试'}`); }
  };
  const reject = (candidate: VerifiedPatternCandidate) => {
    setCandidates((old) => old.filter((item) => item !== candidate));
  };

  return <section className="card pattern-panel">
    <h3>验证模式</h3>
    <p className="muted">AI 只能提出候选；只有你确认的才会沉淀为本机长期模式。</p>
    {confirmed.length > 0 && <ul className="pattern-list">
      {confirmed.map((pattern) => <li key={pattern.id}><strong>{pattern.statement}</strong><span className="muted">{pattern.evidenceSummary}</span></li>)}
    </ul>}
    {message && <StatusBanner tone={state === 'error' ? 'error' : 'success'}>{message}</StatusBanner>}
    <div className="button-row"><Button variant="ghost" loading={state === 'loading'} onClick={() => void propose()}>提取验证模式候选</Button></div>
    {candidates.length > 0 && <ul className="pattern-candidates">
      {candidates.map((candidate) => <li key={candidate.statement}>
        <strong>{candidate.statement}</strong>
        <span className="muted">{candidate.evidenceSummary}</span>
        <div className="button-row">
          <Button variant="primary" onClick={() => void confirm(candidate)}>确认沉淀</Button>
          <Button variant="ghost" onClick={() => reject(candidate)}>拒绝</Button>
        </div>
      </li>)}
    </ul>}
  </section>;
}
