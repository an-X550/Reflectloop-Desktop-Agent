import { useState } from 'react';
import type { IntentResolution, Journal, Review, WorkflowIntent } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';
import { Button } from '../components/button';
import { resolveNextStep } from '../domain/next-step';
import { intentToTarget } from '../domain/intent-target';
import { toLocalDateString } from '../utils/local-date';

const today = toLocalDateString();

const INTENT_LABELS: Record<WorkflowIntent, string> = {
  'write-journal': '写日志',
  'daily-review': '每日反馈',
  'weekly-review': '周复盘',
  'monthly-review': '月复盘',
  'project-review': '项目复盘',
  'topic-thinking': '主题思考',
};

export function StartPage({ journals, reviews, hasApiKey, onNavigate }: { journals: Journal[]; reviews: Review[]; hasApiKey: boolean; onNavigate(target: NavigationTarget): void }) {
  const [intentText, setIntentText] = useState('');
  const [resolution, setResolution] = useState<IntentResolution | null>(null);
  const [routing, setRouting] = useState(false);
  const route = async () => {
    setRouting(true);
    try { setResolution(await window.zhiji.intent.resolve({ text: intentText.trim() })); }
    catch (reason) { setResolution({ kind: 'clarify', question: `暂时无法识别意图：${reason instanceof Error ? reason.message : '请稍后重试'}` }); }
    finally { setRouting(false); }
  };
  const nextStep = resolveNextStep({ today, dayOfWeek: new Date(`${today}T12:00:00`).getDay(), journals, reviews });
  const actionLabel = nextStep.kind === 'write-journal' ? '开始记录' : nextStep.title;
  return <div className="start-page">
    <header className="start-hero"><time>{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${today}T12:00:00`))}</time><h2>从记录开始，看见真正的变化</h2></header>
    <section className="card intent-card">
      <h3>想做点什么？</h3>
      <p className="muted">用一句话描述，只会被带路到已有功能，不会创建新流程。</p>
      <div className="form-row">
        <input aria-label="意图描述" value={intentText} onChange={(event) => setIntentText(event.target.value)} placeholder="例如：本周复盘、看看今天的反馈、聊聊职业选择…"/>
        <Button variant="ghost" loading={routing} disabled={!intentText.trim()} onClick={() => void route()}>出发</Button>
      </div>
      {resolution?.kind === 'matched' && <div className="button-row">
        <Button variant="primary" onClick={() => onNavigate(intentToTarget(resolution.intent))}>前往：{INTENT_LABELS[resolution.intent]}</Button>
        <span className="muted">{resolution.reason}</span>
      </div>}
      {resolution?.kind === 'clarify' && <p className="intent-clarify">{resolution.question}</p>}
    </section>
    <section className="next-step-card">
      <span>建议下一步</span>
      <h3>{nextStep.title}</h3>
      <p>{nextStep.reason}</p>
      <Button variant="primary" onClick={() => onNavigate(nextStep.target)}>{actionLabel}</Button>
    </section>
    <section className="start-capabilities" aria-label="其他可以做的事">
      <h3>其他可以做的事</h3>
      <div className="capability-links">
        <button onClick={() => onNavigate({ view: 'reviews' })}><strong>做复盘</strong><span>周、月或项目</span></button>
        <button onClick={() => onNavigate({ view: 'journal', intent: { type: 'records.journals' } })}><strong>查看记录</strong><span>过去日志</span></button>
        <button onClick={() => onNavigate({ view: 'projects' })}><strong>管理项目</strong><span>关联长期目标</span></button>
      </div>
    </section>
    <p className="start-status">数据已保存在本机 · {hasApiKey ? 'AI 已配置' : 'AI 尚未配置'}</p>
  </div>;
}
