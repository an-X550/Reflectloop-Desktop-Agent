import { describe, expect, it } from 'vitest';
import { GenerateInsightReview } from '../../src/main-process/application/generate-insight-review';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journals: Journal[] = Array.from({ length: 3 }, (_, index) => ({ schemaVersion: 1, id: `journal_a${index}`, date: `2026-08-${String(index + 10).padStart(2, '0')}`, createdAt: `2026-08-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`, updatedAt: `2026-08-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`, projectIds: [], body: `记录 ${index}` }));
const tasks = { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never;

describe('GenerateInsightReview', () => {
  it('requires preview confirmation and saves only confirmed coaching sources', async () => {
    const saved: Review[] = [];
    let messages: { content: string }[] = [];
    const service = new GenerateInsightReview({ list: async () => journals } as never, { list: async () => [], save: async (review: Review) => { saved.push(review); return review; } } as never, { collect: async (next: { content: string }[]) => { messages = next; return '# 日志质量\n建议更具体。'; } }, tasks, () => '2026-08-13T10:00:00.000Z');
    const input = { type: 'coach' as const, start: '2026-08-01', end: '2026-08-13', model: 'fake' };
    await expect(service.execute({ ...input, previewToken: 'missing' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result).toMatchObject({ type: 'coach', promptVersion: 'journal-coach-v1', sourceIds: journals.map((item) => item.id) });
    expect(messages[0].content).toContain('日志质量');
    expect(saved).toHaveLength(1);
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
    let payload = '';
    const service = new GenerateInsightReview({ list: async () => journals } as never, { list: async () => [], save: async (review: Review) => review } as never, { collect: async (messages: { content: string }[]) => { payload = messages[1].content; return '# 方向校准'; } }, tasks, () => '2026-08-13T10:00:00.000Z', { get: async () => ({ body: '准备转向前端', enabledForAi: true }) } as never);
    const input = { type: 'life-design' as const, start: '2026-08-01', end: '2026-08-13', topic: '下一份工作', model: 'fake' };
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(JSON.parse(payload)).toMatchObject({ topic: '下一份工作', profile: '准备转向前端' });
    expect(result.promptVersion).toBe('life-design-v1');
  });
});
