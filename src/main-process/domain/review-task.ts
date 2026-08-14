import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';

export type ReviewTaskPhase = 'queued' | 'building_context' | 'generating' | 'validating' | 'saving' | 'completed' | 'failed' | 'cancelled';
export interface ReviewTask { taskId: string; phase: ReviewTaskPhase; controller: AbortController }
const terminal = new Set<ReviewTaskPhase>(['completed', 'failed', 'cancelled']);

export class ReviewTaskManager {
  private current: ReviewTask | null = null;
  /** 每次阶段切换时通知（如推送给渲染进程展示生成进度）；由 IPC 层按调用方注入。 */
  onTransition?: (phase: ReviewTaskPhase) => void;
  start(): ReviewTask {
    if (this.current && !terminal.has(this.current.phase)) throw appError({ code: 'TASK_ALREADY_RUNNING' });
    this.current = { taskId: crypto.randomUUID(), phase: 'queued', controller: new AbortController() };
    this.onTransition?.('queued');
    return this.current;
  }
  transition(taskId: string, phase: ReviewTaskPhase) { if (this.current?.taskId === taskId) { this.current.phase = phase; this.onTransition?.(phase); } }
  cancel(taskId: string) { if (this.current?.taskId === taskId) { this.current.controller.abort(); this.current.phase = 'cancelled'; this.onTransition?.('cancelled'); } }
  getCurrent() { return this.current; }
}
