import { describe, expect, it } from 'vitest';
import { selectProjectMaterials } from '../../src/main-process/domain/project-materials';
import type { Journal } from '../../src/shared/schemas/domain';

const journal = (id: string, date: string, projectIds: string[]): Journal => ({
  schemaVersion: 1, id, date, projectIds, body: id,
  createdAt: `${date}T10:00:00+08:00`, updatedAt: `${date}T10:00:00+08:00`,
});

describe('selectProjectMaterials', () => {
  it('combines linked and ranged journals without duplicates', () => {
    const journals = [
      journal('journal_a1', '2026-08-01', ['project_a1']),
      journal('journal_a2', '2026-08-02', []),
      journal('journal_a3', '2026-08-03', ['project_a1']),
    ];
    expect(selectProjectMaterials('project_a1', { start: '2026-08-01', end: '2026-08-02' }, journals).map((x) => x.id))
      .toEqual(['journal_a1', 'journal_a2', 'journal_a3']);
  });
});
