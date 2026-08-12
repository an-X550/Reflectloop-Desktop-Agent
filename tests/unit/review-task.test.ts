import { describe, expect, it } from 'vitest';
import { ReviewTaskManager } from '../../src/main-process/domain/review-task';

describe('ReviewTaskManager', () => {
  it('allows only one active generation and supports cancellation', () => {
    const manager = new ReviewTaskManager();
    const first = manager.start();
    expect(() => manager.start()).toThrowError(expect.objectContaining({ code: 'TASK_ALREADY_RUNNING' }));
    manager.cancel(first.taskId);
    expect(manager.getCurrent()?.phase).toBe('cancelled');
    expect(() => manager.start()).not.toThrow();
  });
});
