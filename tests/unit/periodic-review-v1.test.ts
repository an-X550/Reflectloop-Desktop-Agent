import { describe, expect, it } from 'vitest';
import { PERIODIC_REVIEW_PROMPT_VERSION, parsePeriodicReviewOutput, periodicSystemPrompt, renderPeriodicReview } from '../../src/main-process/prompts/periodic-review-v1';

const validOutput = {
  summary: '本周完成了三个功能',
  effectiveActions: '上午关消息有效，完成了核心交付',
  ineffectiveActions: '晚间加班效果递减',
  evidenceAndConflicts: '日志显示周二效率最高',
  ifRedone: '会把测试前置',
  nextAction: { step: '写下周一计划的第一行', prediction: '下周一会直接开始' },
};

describe('periodic-review-v1', () => {
  it('exposes a stable prompt version', () => {
    expect(PERIODIC_REVIEW_PROMPT_VERSION).toBe('periodic-review-v2');
  });

  it('includes grade-specific rules in the system prompt', () => {
    const promptA = periodicSystemPrompt('weekly', 'A');
    const promptB = periodicSystemPrompt('weekly', 'B');
    const promptC = periodicSystemPrompt('monthly', 'C');
    expect(promptA).toContain('A 级证据');
    expect(promptB).toContain('B 级证据');
    expect(promptC).toContain('C 级证据');
  });

  it('explains downstream-first material roles in the system prompt', () => {
    const prompt = periodicSystemPrompt('weekly', 'A');
    expect(prompt).toContain('下游沉淀优先');
    expect(prompt).toContain('materials.primary');
    expect(prompt).toContain('materials.journalIndex');
  });

  it('parses a valid JSON output', () => {
    const result = parsePeriodicReviewOutput(JSON.stringify(validOutput));
    expect(result.summary).toBe('本周完成了三个功能');
    expect(result.nextAction.step).toBe('写下周一计划的第一行');
  });

  it('parses a fenced code-block JSON output', () => {
    const fenced = '```json\n' + JSON.stringify(validOutput) + '\n```';
    const result = parsePeriodicReviewOutput(fenced);
    expect(result.summary).toBe('本周完成了三个功能');
  });

  it('rejects output with missing fields', () => {
    expect(() => parsePeriodicReviewOutput(JSON.stringify({ summary: 'only summary' }))).toThrow();
  });

  it('renders a readable Markdown review', () => {
    const rendered = renderPeriodicReview(validOutput as never, 'weekly', '2026-08-10', '2026-08-16');
    expect(rendered).toContain('周报');
    expect(rendered).toContain('2026-08-10');
    expect(rendered).toContain('本周完成了三个功能');
    expect(rendered).toContain('行动：写下周一计划的第一行');
  });
});
