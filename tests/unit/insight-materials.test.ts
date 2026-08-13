import { describe, expect, it } from 'vitest';
import { selectInsightMaterials } from '../../src/main-process/domain/insight-materials';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journal = (id: string, date: string): Journal => ({ schemaVersion: 1, id: `journal_${id}`, date, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, projectIds: [], body: id });
const review = (id: string, type: Review['type'], start: string): Review => ({ schemaVersion: 1, id: `review_${id}`, type, periodStart: start, periodEnd: start, sourceIds: ['journal_a1'], projectId: null, provider: 'openai-compatible', model: 'test', promptVersion: `${type}-v1`, createdAt: `${start}T10:00:00.000Z`, body: id });

describe('selectInsightMaterials', () => {
  it('requires at least three journals for coaching', () => {
    const two = [journal('a1', '2026-08-11'), journal('b2', '2026-08-12')];
    expect(() => selectInsightMaterials({ type: 'coach', start: '2026-08-01', end: '2026-08-13' }, two, [])).toThrow(/3/);
    expect(selectInsightMaterials({ type: 'coach', start: '2026-08-01', end: '2026-08-13' }, [...two, journal('c3', '2026-08-13')], [])).toHaveLength(3);
  });

  it('uses six or more monthly reviews for a yearly review', () => {
    const months = Array.from({ length: 6 }, (_, index) => review(`m${index}`, 'monthly', `2026-${String(index + 1).padStart(2, '0')}-01`));
    expect(() => selectInsightMaterials({ type: 'yearly', start: '2026-01-01', end: '2026-12-31' }, [], months.slice(0, 5))).toThrow(/6/);
    expect(selectInsightMaterials({ type: 'yearly', start: '2026-01-01', end: '2026-12-31' }, [], months)).toEqual(months);
  });

  it('prefers higher-level reviews and caps life-design context', () => {
    const journals = Array.from({ length: 70 }, (_, index) => journal(`j${index}`, `2026-07-${String((index % 28) + 1).padStart(2, '0')}`));
    const reviews = [review('month', 'monthly', '2026-07-01'), review('week', 'weekly', '2026-07-20')];
    const materials = selectInsightMaterials({ type: 'life-design', start: '2026-07-01', end: '2026-07-31' }, journals, reviews);
    expect(materials.length).toBeLessThanOrEqual(40);
    expect(materials.map((item) => item.id)).toEqual(expect.arrayContaining(['review_month', 'review_week']));
  });
});
