import { describe, expect, it, vi } from 'vitest';
import { GeneratePeriodicReview } from '../../src/main-process/application/generate-periodic-review';
import type { Journal } from '../../src/shared/schemas/domain';

const journal: Journal = { schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: ['project_a1'], body: '证据' };

const validModelOutput = JSON.stringify({
  summary: '完成了功能开发',
  effectiveActions: '上午专注有效',
  ineffectiveActions: '晚间加班效果递减',
  evidenceAndConflicts: '日志显示进展',
  ifRedone: '会更早开始测试',
  nextAction: { step: '写下一次计划的第一行', prediction: '下周会直接开始' },
});

describe('GeneratePeriodicReview', () => {
  it('injects an enabled profile as separate context', async () => {
    let sent = '';
    const profiles = { get: async () => ({ body: '长期目标是做有价值的产品', enabledForAi: true }) } as never;
    const service = new GeneratePeriodicReview(
      { list: async () => [journal] } as never,
      { list: async () => [], save: async (review: unknown) => review } as never,
      { collect: async (messages: { content: string }[]) => { sent = messages.at(-1)?.content ?? ''; return validModelOutput; } } as never,
      { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never,
      () => '2026-08-13T10:00:00.000Z',
      profiles,
    );
    const input = { type: 'project' as const, start: '2026-08-01', end: '2026-08-31', projectId: 'project_a1', model: 'fake' };
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result.kind).toBe('review');
    expect(JSON.parse(sent)).toMatchObject({ profile: '长期目标是做有价值的产品' });
  });

  it('requires a fresh preview token and limits the model to confirmed sources', async () => {
    const service = new GeneratePeriodicReview(
      { list: async () => [journal] } as never,
      { list: async () => [], save: async (review: unknown) => review } as never,
      { collect: async () => validModelOutput } as never,
      { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never,
      () => '2026-08-13T10:00:00.000Z',
    );
    const input = { type: 'project' as const, start: '2026-08-01', end: '2026-08-31', projectId: 'project_a1', model: 'fake' };
    await expect(service.execute({ ...input, previewToken: 'missing' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result.kind).toBe('review');
    if (result.kind === 'review') {
      expect(result.review.sourceIds).toEqual(['journal_a1']);
    }
  });

  it('returns a clarification instead of saving when evidence is D-grade', async () => {
    const collect = vi.fn();
    const service = new GeneratePeriodicReview(
      { list: async () => [] } as never,
      { list: async () => [], save: async () => undefined } as never,
      { collect } as never,
      { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never,
      () => '2026-08-13T10:00:00.000Z',
    );
    const input = { type: 'project' as const, start: '2026-08-01', end: '2026-08-31', projectId: 'project_a1', model: 'fake' };
    await expect(service.preview(input)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(collect).not.toHaveBeenCalled();
  });
});
