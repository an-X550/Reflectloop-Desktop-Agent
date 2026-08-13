import { describe, expect, it } from 'vitest';
import { CreateJournalInputSchema, UpdateJournalInputSchema } from '../../src/shared/schemas/ipc';

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
