import { describe, expect, it } from 'vitest';
import { buildDailyEvidence } from '../../src/main-process/skill-runtime/daily-evidence';
import type { Journal } from '../../src/shared/schemas/domain';

const journal = (body: string): Journal => ({
  schemaVersion: 1,
  id: 'journal_a1',
  date: '2026-08-13',
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
  projectIds: [],
  body,
});

describe('buildDailyEvidence', () => {
  it.each([
    ['A', '完成了报告，感到轻松。我发现上午先关消息有效，明天继续。'],
    ['B', '完成了报告，但很累。'],
    ['C', '今天很累。'],
    ['D', '不知道。'],
  ] as const)('classifies explicit free narrative as %s', (grade, body) => {
    expect(buildDailyEvidence([journal(body)]).grade).toBe(grade);
  });

  it('does not lower a complete free narrative because it lacks template headings', () => {
    const evidence = buildDailyEvidence([journal('我完成了报告，感觉轻松。我发现上午先关消息效率更高，明天继续这样开始。')]);
    expect(evidence).toMatchObject({ grade: 'A' });
    expect(evidence.facts.some((item) => item.includes('我完成了报告'))).toBe(true);
    expect(evidence.states.some((item) => item.includes('感觉轻松'))).toBe(true);
    expect(evidence.interpretations.some((item) => item.includes('我发现上午先关消息效率更高'))).toBe(true);
    expect(evidence.intentions.some((item) => item.includes('明天继续这样开始'))).toBe(true);
  });

  it('explains the evidence gap for a D-grade input', () => {
    expect(buildDailyEvidence([journal('不知道。')]).gaps).toContain('缺少可确认的本人经历或具体事件');
  });
});
