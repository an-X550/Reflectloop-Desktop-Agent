import type { Journal } from '../../shared/schemas/domain';

export interface DateRange { start: string; end: string }

export function selectProjectMaterials(
  projectId: string,
  range: DateRange | null,
  journals: Journal[],
): Journal[] {
  const selected = new Map<string, Journal>();
  for (const journal of journals) {
    const linked = journal.projectIds.includes(projectId);
    const ranged = range !== null && journal.date >= range.start && journal.date <= range.end;
    if (linked || ranged) selected.set(journal.id, journal);
  }
  return [...selected.values()].sort((a, b) => a.date.localeCompare(b.date));
}
