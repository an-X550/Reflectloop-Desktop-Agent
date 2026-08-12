import { describe, expect, it } from 'vitest';
import { selectMaterials } from '../../src/main-process/domain/material-selector';
import type { Journal, Review } from '../../src/shared/schemas/domain';

const journal = (id: string, date: string, projectIds: string[] = []): Journal => ({ schemaVersion: 1, id, date, projectIds, createdAt: `${date}T00:00:00.000Z`, updatedAt: `${date}T00:00:00.000Z`, body: id });
describe('selectMaterials', () => {
  it('deduplicates project links and explicit date ranges', () => {
    const journals = [journal('journal_a1', '2026-08-01', ['project_a1']), journal('journal_a2', '2026-08-05'), journal('journal_a3', '2026-09-01', ['project_a1'])];
    expect(selectMaterials({ type: 'project', start: '2026-08-01', end: '2026-08-31', projectId: 'project_a1' }, journals, [] as Review[]).map((x) => x.id)).toEqual(['journal_a1', 'journal_a2', 'journal_a3']);
  });
});
