import { describe, expect, it } from 'vitest';
import { JournalSchema, ReviewSchema } from '../../src/shared/schemas/domain';

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

describe('ReviewSchema', () => {
  it.each(['coach', 'yearly', 'life-design'] as const)('accepts the %s insight review type', (type) => {
    expect(ReviewSchema.parse({
      schemaVersion: 1,
      id: 'review_a1',
      type,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      sourceIds: ['journal_a1'],
      projectId: null,
      provider: 'openai-compatible',
      model: 'test',
      promptVersion: `${type}-v1`,
      createdAt: '2026-08-13T10:00:00.000Z',
      body: '# result',
    })).toMatchObject({ type });
  });
});
