import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';

export type ReviewTaskPhase = 'queued' | 'building_context' | 'generating' | 'validating' | 'saving' | 'completed' | 'failed' | 'cancelled';
export interface ReviewTask { taskId: string; phase: ReviewTaskPhase; controller: AbortController }
const terminal = new Set<ReviewTaskPhase>(['completed', 'failed', 'cancelled']);

export class ReviewTaskManager {
  private current: ReviewTask | null = null;
  start(): ReviewTask {
    if (this.current && !terminal.has(this.current.phase)) throw appError({ code: 'TASK_ALREADY_RUNNING' });
    this.current = { taskId: crypto.randomUUID(), phase: 'queued', controller: new AbortController() };
    return this.current;
  }
  transition(taskId: string, phase: ReviewTaskPhase) { if (this.current?.taskId === taskId) this.current.phase = phase; }
  cancel(taskId: string) { if (this.current?.taskId === taskId) { this.current.controller.abort(); this.current.phase = 'cancelled'; } }
  getCurrent() { return this.current; }
}
