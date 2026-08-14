import type { WorkflowIntent } from '../../shared/schemas/domain';
import type { NavigationTarget } from '../app/navigation';

/**
 * 把固定的工作流意图映射到既有导航目标；路由只负责带路，不创建新视图或新流程。
 * project-review 不带 projectId：由复盘页让用户选择具体项目。
 */
export function intentToTarget(intent: WorkflowIntent): NavigationTarget {
  switch (intent) {
    case 'write-journal': return { view: 'journal', intent: { type: 'journal.compose' } };
    case 'daily-review': return { view: 'journal', intent: { type: 'journal.generate-daily' } };
    case 'weekly-review': return { view: 'reviews', intent: { type: 'review.weekly' } };
    case 'monthly-review': return { view: 'reviews', intent: { type: 'review.monthly' } };
    case 'project-review': return { view: 'reviews' };
    case 'topic-thinking': return { view: 'topics' };
  }
}
