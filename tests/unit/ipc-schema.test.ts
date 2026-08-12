import { describe, expect, it } from 'vitest';
import { SaveJournalInputSchema } from '../../src/shared/schemas/ipc';

describe('SaveJournalInputSchema', () => {
  it('rejects ambiguous dates before repository access', () => {
    expect(() => SaveJournalInputSchema.parse({ date: 'today', body: 'x', projectIds: [] })).toThrow();
  });
});
