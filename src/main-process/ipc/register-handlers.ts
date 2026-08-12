import { ipcMain } from 'electron';
import { z } from 'zod';
import { CreateProjectInputSchema, IdSchema, JournalQuerySchema, SaveJournalInputSchema } from '../../shared/schemas/ipc';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { JsonProjectRepository } from '../infrastructure/markdown/project-repository';
import type { SaveJournal } from '../application/save-journal';

export function registerHandlers(deps: { saveJournal: SaveJournal; journals: MarkdownJournalRepository; projects: JsonProjectRepository }) {
  ipcMain.handle('journals:save', (_event, raw) => deps.saveJournal.execute(SaveJournalInputSchema.parse(raw)));
  ipcMain.handle('journals:list', async (_event, raw = {}) => {
    const query = JournalQuerySchema.parse(raw);
    return (await deps.journals.list()).filter((item) => (!query.start || item.date >= query.start) && (!query.end || item.date <= query.end) && (!query.projectId || item.projectIds.includes(query.projectId)));
  });
  ipcMain.handle('journals:get', (_event, raw) => deps.journals.get(IdSchema.parse(raw)));
  ipcMain.handle('projects:create', (_event, raw) => deps.projects.create(CreateProjectInputSchema.parse(raw).name));
  ipcMain.handle('projects:list', () => deps.projects.list());
  ipcMain.handle('projects:archive', (_event, raw) => deps.projects.archive(IdSchema.refine((id) => id.startsWith('project_')).parse(raw)));
}
