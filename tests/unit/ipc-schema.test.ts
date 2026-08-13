import { describe, expect, it } from 'vitest';
import { CreateJournalInputSchema, PeriodicReviewGenerateInputSchema, PeriodicReviewPreviewInputSchema, UpdateJournalInputSchema } from '../../src/shared/schemas/ipc';

describe('journal input schemas', () => {
  it('rejects ambiguous dates before repository access', () => {
    expect(CreateJournalInputSchema).toBeDefined();
    expect(() => CreateJournalInputSchema.parse({ date: 'today', body: 'x', projectIds: [] })).toThrow();
  });

  it('requires an optimistic concurrency version for updates', () => {
    expect(UpdateJournalInputSchema).toBeDefined();
    expect(() => UpdateJournalInputSchema.parse({ id: 'journal_a1', date: '2026-08-13', body: 'x', projectIds: [] })).toThrow();
  });

  it('rejects impossible calendar dates', () => {
    expect(() => CreateJournalInputSchema.parse({ date: '2026-02-30', body: 'x', projectIds: [] })).toThrow();
  });
});

describe('periodic review input schemas', () => {
  it('parses preview input without transforming a refined schema', () => {
    for (const type of ['weekly', 'monthly', 'project'] as const) {
      expect(PeriodicReviewPreviewInputSchema.parse({ type, start: '2026-08-10', end: '2026-08-16' })).toEqual({ type, start: '2026-08-10', end: '2026-08-16' });
    }
  });

  it('requires a preview token before generation', () => {
    expect(() => PeriodicReviewGenerateInputSchema.parse({ type: 'weekly', start: '2026-08-10', end: '2026-08-16' })).toThrow();
    expect(() => PeriodicReviewGenerateInputSchema.parse({ type: 'weekly', start: '2026-08-16', end: '2026-08-10', previewToken: 'b49ef530-786a-47d9-bf8a-c826cf3ea239' })).toThrow();
  });
});
