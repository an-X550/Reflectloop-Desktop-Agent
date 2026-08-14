import { describe, expect, it } from 'vitest';
import { GenerateInsightReview } from '../../src/main-process/application/generate-insight-review';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journals: Journal[] = Array.from({ length: 3 }, (_, index) => ({ schemaVersion: 1, id: `journal_a${index}`, date: `2026-08-${String(index + 10).padStart(2, '0')}`, createdAt: `2026-08-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`, updatedAt: `2026-08-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`, projectIds: [], body: `记录 ${index}` }));
const tasks = { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never;

describe('GenerateInsightReview', () => {
  it('requires preview confirmation and saves only confirmed coaching sources', async () => {
    const saved: Review[] = [];
    let messages: { content: string }[] = [];
    let options: { jsonObject?: boolean } | undefined;
    const coachOutput = { summary: ['三篇都有具体事件。', '思考证据较少。'], entries: journals.map((item) => ({ date: item.date, readiness: 'B', evidence: '有具体记录', missing: '解释' })), sixSteps: journals.map((item) => ({ date: item.date, facts: '有', focus: '部分', feelings: '未观察到', thinking: '未观察到', action: '未观察到', sharing: '未观察到' })), patterns: { stable: '事实', missing: '解释', issue: '停留在事件罗列' }, priorityAction: '下一篇只补一句“为什么这件事重要”。', directionWarning: null };
    const service = new GenerateInsightReview({ list: async () => journals } as never, { list: async () => [], save: async (review: Review) => { saved.push(review); return review; } } as never, { collect: async (next: { content: string }[], _signal: unknown, nextOptions?: { jsonObject?: boolean }) => { messages = next; options = nextOptions; return JSON.stringify(coachOutput); } }, tasks, () => '2026-08-13T10:00:00.000Z');
    const input = { type: 'coach' as const, start: '2026-08-01', end: '2026-08-13', model: 'fake' };
    await expect(service.execute({ ...input, previewToken: 'missing' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result).toMatchObject({ type: 'coach', promptVersion: 'journal-coach-v3', sourceIds: journals.map((item) => item.id) });
    expect(messages[0].content).toContain('日志质量');
    expect(messages[0].content).toContain('分析就绪度');
    expect(messages[0].content).toContain('六步法写作习惯');
    expect(messages[0].content).toContain('回忆事实、筛选重点、评估结果、洞察思考、行为改进、分享讨论');
    expect(messages[0].content).toContain('反复怀疑长期方向');
    expect(messages[0].content).toContain('单日情绪低落或普通任务压力不触发');
    expect(options).toEqual({ jsonObject: true });
    expect(result.body).toContain('# 日志教练报告：2026-08-01..2026-08-13');
    expect(result.body).toContain('| 日期 | 等级 | 已有证据 | 最值得补充 |');
    expect(result.body).toContain('## 优先改进的一件事');
    expect(saved).toHaveLength(1);
  });

  it('requires at least three journals for a meaningful quality review', async () => {
    const service = new GenerateInsightReview({ list: async () => journals.slice(0, 2) } as never, { list: async () => [], save: async (review: Review) => review } as never, { collect: async () => 'unused' }, tasks);
    const input = { type: 'coach' as const, start: '2026-08-01', end: '2026-08-13', model: 'fake' };
    await expect(service.preview(input)).rejects.toMatchObject({ code: 'INVALID_INPUT', message: '范围内仅找到 2 篇日志条目。至少需要3篇才能做有意义的教练分析。' });
  });

  it('invalidates a preview when materials change', async () => {
    let current = journals;
    const service = new GenerateInsightReview({ list: async () => current } as never, { list: async () => [], save: async (review: Review) => review } as never, { collect: async () => '# result' }, tasks);
    const input = { type: 'coach' as const, start: '2026-08-01', end: '2026-08-13', model: 'fake' };
    const preview = await service.preview(input);
    current = [...journals, { ...journals[0], id: 'journal_z9' }];
    await expect(service.execute({ ...input, previewToken: preview.token })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('adds an enabled profile and topic to quick life design', async () => {
    let system = '';
    let payload = '';
    const service = new GenerateInsightReview({ list: async () => journals } as never, { list: async () => [], save: async (review: Review) => review } as never, { collect: async (messages: { content: string }[]) => { system = messages[0].content; payload = messages[1].content; return '# 方向校准'; } }, tasks, () => '2026-08-13T10:00:00.000Z', { get: async () => ({ body: '准备转向前端', enabledForAi: true }) } as never);
    const input = { type: 'life-design' as const, start: '2026-08-01', end: '2026-08-13', topic: '下一份工作', model: 'fake' };
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(JSON.parse(payload)).toMatchObject({ topic: '下一份工作', profile: '准备转向前端' });
    expect(system).toContain('下次如何验证');
    expect(result.promptVersion).toBe('life-design-v2');
  });

  it('requires six monthly reviews and carries the yearly escalation reminder contract', async () => {
    const monthly = (index: number): Review => ({ schemaVersion: 1, id: `review_m${index}`, type: 'monthly', periodStart: `2026-${String(index + 1).padStart(2, '0')}-01`, periodEnd: `2026-${String(index + 1).padStart(2, '0')}-28`, sourceIds: [], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'periodic-review-v4', createdAt: '2026-08-01T00:00:00.000Z', body: `月报 ${index}` });
    let system = '';
    const reviews = Array.from({ length: 6 }, (_, index) => monthly(index));
    const service = new GenerateInsightReview({ list: async () => journals } as never, { list: async () => reviews, save: async (review: Review) => review } as never, { collect: async (messages: { content: string }[]) => { system = messages[0].content; return '# 年度回顾'; } }, tasks, () => '2026-08-13T10:00:00.000Z');
    const input = { type: 'yearly' as const, start: '2026-01-01', end: '2026-12-31', model: 'fake' };
    await expect(service.execute({ ...input, previewToken: 'missing' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result).toMatchObject({ type: 'yearly', promptVersion: 'yearly-review-v2' });
    expect(system).toContain('长期方向冲突');
    expect(system).toContain('方向校准');
    expect(system).not.toContain('/life-design');
    expect(system).not.toContain('自动生成');
  });
});
