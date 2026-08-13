import { describe, expect, it } from 'vitest';
import { DAILY_FEEDBACK_COMPATIBILITY } from '../../src/main-process/skill-runtime/compatibility/daily-feedback-v1';

describe('desktop daily feedback runtime', () => {
  it('uses a frozen desktop compatibility snapshot without reading .claude', () => {
    expect(DAILY_FEEDBACK_COMPATIBILITY.id).toBe('desktop-daily-feedback-v1');
    expect(DAILY_FEEDBACK_COMPATIBILITY.materialCategories).toEqual([
      'target-journals',
      'previous-daily-review',
      'verified-patterns',
    ]);
    expect(DAILY_FEEDBACK_COMPATIBILITY.runtimeReadsClaudeDirectory).toBe(false);
  });
});
