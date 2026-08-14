import { describe, expect, it } from 'vitest';
import { VerifiedPatternSchema, VerifiedPatternSnapshotSchema } from '../../src/shared/schemas/domain';

const validPattern = {
  schemaVersion: 1 as const,
  id: 'pattern_a1b2',
  statement: '上午先关闭消息再开始核心交付时，更容易在当天看到进展',
  evidenceSummary: '2026-08-12 与 2026-08-13 日反馈均提到上午专注后完成交付',
  sourceReviewIds: ['review_a1', 'review_b2'],
  createdAt: '2026-08-13T10:00:00.000Z',
};

describe('VerifiedPatternSchema', () => {
  it('accepts a valid confirmed pattern', () => {
    expect(VerifiedPatternSchema.parse(validPattern)).toMatchObject({ id: 'pattern_a1b2' });
  });

  it('rejects path-like ids and empty statements', () => {
    expect(() => VerifiedPatternSchema.parse({ ...validPattern, id: '../escape' })).toThrow();
    expect(() => VerifiedPatternSchema.parse({ ...validPattern, statement: '  ' })).toThrow();
  });

  it('rejects candidates without any source review', () => {
    expect(() => VerifiedPatternSchema.parse({ ...validPattern, sourceReviewIds: [] })).toThrow();
  });
});

describe('VerifiedPatternSnapshotSchema', () => {
  it('accepts an empty snapshot and a populated snapshot', () => {
    expect(VerifiedPatternSnapshotSchema.parse({ schemaVersion: 1, updatedAt: '2026-08-13T10:00:00.000Z', patterns: [] }).patterns).toHaveLength(0);
    expect(VerifiedPatternSnapshotSchema.parse({ schemaVersion: 1, updatedAt: '2026-08-13T10:00:00.000Z', patterns: [validPattern] }).patterns).toHaveLength(1);
  });

  it('rejects a snapshot with an invalid pattern', () => {
    expect(() => VerifiedPatternSnapshotSchema.parse({ schemaVersion: 1, updatedAt: '2026-08-13T10:00:00.000Z', patterns: [{ ...validPattern, id: 'bad' }] })).toThrow();
  });
});
