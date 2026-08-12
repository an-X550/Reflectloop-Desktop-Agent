import { describe, expect, it } from 'vitest';
import { JournalSchema } from '../../src/shared/schemas/domain';

describe('JournalSchema', () => {
  it('rejects path-like ids and non ISO dates', () => {
    expect(() => JournalSchema.parse({
      schemaVersion: 1,
      id: '../escape',
      date: '13/08/2026',
      createdAt: '2026-08-13T10:00:00+08:00',
      updatedAt: '2026-08-13T10:00:00+08:00',
      projectIds: [],
      body: 'text',
    })).toThrow();
  });
});
