import { describe, expect, it } from 'vitest';
import { buildPeriodicModelMaterials } from '../../src/main-process/skill-runtime/periodic-materials';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journal = (date: string, body = `日志${date}`): Journal => ({
  schemaVersion: 1, id: `journal_${date}`, date, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, projectIds: [], body,
});

const review = (type: Review['type'], date: string, body = `${type}复盘${date}`): Review => ({
  schemaVersion: 2, id: `review_${type}_${date}`, type, periodStart: date, periodEnd: date, sourceIds: [`journal_${date}`], sourceVersions: [], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'periodic-review-v1', createdAt: `${date}T10:00:00.000Z`, body,
});

describe('buildPeriodicModelMaterials', () => {
  it('weekly with enough daily reviews uses them as primary and keeps journals as index only', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')];
    const dailies = [review('daily', '2026-08-10'), review('daily', '2026-08-11'), review('daily', '2026-08-12')];
    const materials = buildPeriodicModelMaterials('weekly', journals, dailies);
    expect(materials.primary.kind).toBe('daily-reviews');
    expect(materials.primary.items).toHaveLength(3);
    expect(materials.supplement).toBeNull();
    expect(materials.journalIndex).toHaveLength(3);
    expect(materials.journalIndex[0]).not.toHaveProperty('body');
  });

  it('weekly with too few daily reviews supplements full journals', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')];
    const dailies = [review('daily', '2026-08-10')];
    const materials = buildPeriodicModelMaterials('weekly', journals, dailies);
    expect(materials.primary.kind).toBe('daily-reviews');
    expect(materials.supplement?.kind).toBe('journals');
    expect(materials.supplement?.items).toHaveLength(3);
    expect(materials.supplement?.items[0]).toHaveProperty('body');
  });

  it('weekly without daily reviews falls back to journals as primary', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11')];
    const materials = buildPeriodicModelMaterials('weekly', journals, []);
    expect(materials.primary.kind).toBe('journals');
    expect(materials.primary.items).toHaveLength(2);
    expect(materials.supplement).toBeNull();
  });

  it('monthly with enough weekly reviews uses them as primary and keeps journals as index only', () => {
    const journals = [journal('2026-08-01')];
    const weeklies = [review('weekly', '2026-07-28'), review('weekly', '2026-08-04'), review('weekly', '2026-08-11')];
    const materials = buildPeriodicModelMaterials('monthly', journals, weeklies);
    expect(materials.primary.kind).toBe('weekly-reviews');
    expect(materials.primary.items).toHaveLength(3);
    expect(materials.supplement).toBeNull();
  });

  it('monthly with too few weekly reviews supplements full journals', () => {
    const journals = [journal('2026-08-01'), journal('2026-08-02')];
    const weeklies = [review('weekly', '2026-08-04')];
    const materials = buildPeriodicModelMaterials('monthly', journals, weeklies);
    expect(materials.primary.kind).toBe('weekly-reviews');
    expect(materials.supplement?.kind).toBe('journals');
    expect(materials.supplement?.items).toHaveLength(2);
  });

  it('project reviews always use journals as primary', () => {
    const journals = [journal('2026-08-10'), journal('2026-08-11')];
    const materials = buildPeriodicModelMaterials('project', journals, []);
    expect(materials.primary.kind).toBe('journals');
    expect(materials.supplement).toBeNull();
    expect(materials.journalIndex).toHaveLength(2);
  });
});
