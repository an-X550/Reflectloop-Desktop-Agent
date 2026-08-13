import type { Journal, Review } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';
import { Button } from '../components/button';
import { resolveNextStep } from '../domain/next-step';

const today = new Date().toISOString().slice(0, 10);

export function StartPage({ journals, reviews, hasApiKey, onNavigate }: { journals: Journal[]; reviews: Review[]; hasApiKey: boolean; onNavigate(target: NavigationTarget): void }) {
  const nextStep = resolveNextStep({ today, dayOfWeek: new Date(`${today}T12:00:00`).getDay(), journals, reviews });
  const actionLabel = nextStep.kind === 'write-journal' ? '开始记录' : nextStep.title;
  return <div className="start-page">
    <header className="start-hero"><time>{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${today}T12:00:00`))}</time><h2>从记录开始，看见真正的变化</h2></header>
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
