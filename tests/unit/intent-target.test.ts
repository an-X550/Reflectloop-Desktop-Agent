import { describe, expect, it } from 'vitest';
import { intentToTarget } from '../../src/renderer/domain/intent-target';
import type { WorkflowIntent } from '../../src/shared/schemas/domain';

describe('intentToTarget', () => {
  it('maps every fixed workflow intent to an existing navigation target', () => {
    expect(intentToTarget('write-journal')).toEqual({ view: 'journal', intent: { type: 'journal.compose' } });
    expect(intentToTarget('daily-review')).toEqual({ view: 'journal', intent: { type: 'journal.generate-daily' } });
    expect(intentToTarget('weekly-review')).toEqual({ view: 'reviews', intent: { type: 'review.weekly' } });
    expect(intentToTarget('monthly-review')).toEqual({ view: 'reviews', intent: { type: 'review.monthly' } });
    expect(intentToTarget('project-review')).toEqual({ view: 'reviews' });
    expect(intentToTarget('topic-thinking')).toEqual({ view: 'topics' });
  });

  it('covers the full enum exhaustively', () => {
    const intents: WorkflowIntent[] = ['write-journal', 'daily-review', 'weekly-review', 'monthly-review', 'project-review', 'topic-thinking'];
    for (const intent of intents) expect(intentToTarget(intent)).toHaveProperty('view');
  });
});
