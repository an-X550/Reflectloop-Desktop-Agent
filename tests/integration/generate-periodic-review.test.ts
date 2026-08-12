import { describe, expect, it } from 'vitest';
import { GeneratePeriodicReview } from '../../src/main-process/application/generate-periodic-review';
import type { Journal } from '../../src/shared/schemas/domain';

const journal: Journal = { schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: ['project_a1'], body: '证据' };
describe('GeneratePeriodicReview', () => {
  it('requires a fresh preview token and limits the model to confirmed sources', async () => {
    let sent = '';
    const service = new GeneratePeriodicReview({ list: async () => [journal] } as never, { list: async () => [], save: async (review: unknown) => review } as never, { collect: async (messages: { content: string }[]) => { sent = messages.at(-1)?.content ?? ''; return '# 复盘'; } }, { start: () => ({ taskId: 'x', controller: new AbortController(), phase: 'queued' }), transition: () => undefined } as never, () => '2026-08-13T10:00:00.000Z');
    const input = { type: 'project' as const, start: '2026-08-01', end: '2026-08-31', projectId: 'project_a1', model: 'fake' };
    await expect(service.execute({ ...input, previewToken: 'missing' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const preview = await service.preview(input);
    const result = await service.execute({ ...input, previewToken: preview.token });
    expect(result.sourceIds).toEqual(['journal_a1']);
    expect(sent).toContain('journal_a1');
  });
});
