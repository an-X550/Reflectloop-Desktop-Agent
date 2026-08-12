import { ipcMain } from 'electron';
import { CreateProjectInputSchema, GenerateDailyReviewInputSchema, IdSchema, JournalQuerySchema, SaveJournalInputSchema, SaveProviderConfigInputSchema } from '../../shared/schemas/ipc';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { JsonProjectRepository } from '../infrastructure/markdown/project-repository';
import type { SaveJournal } from '../application/save-journal';
import type { ConfigureAi } from '../application/configure-ai';
import type { GenerateDailyReview } from '../application/generate-daily-review';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import type { ReviewTaskManager } from '../domain/review-task';

export function registerHandlers(deps: { saveJournal: SaveJournal; journals: MarkdownJournalRepository; projects: JsonProjectRepository; configureAi: ConfigureAi; generateDailyReview: GenerateDailyReview; reviews: MarkdownReviewRepository; reviewTasks: ReviewTaskManager }) {
  ipcMain.handle('journals:save', (_event, raw) => deps.saveJournal.execute(SaveJournalInputSchema.parse(raw)));
  ipcMain.handle('journals:list', async (_event, raw = {}) => {
    const query = JournalQuerySchema.parse(raw);
    return (await deps.journals.list()).filter((item) => (!query.start || item.date >= query.start) && (!query.end || item.date <= query.end) && (!query.projectId || item.projectIds.includes(query.projectId)));
  });
  ipcMain.handle('journals:get', (_event, raw) => deps.journals.get(IdSchema.parse(raw)));
  ipcMain.handle('projects:create', (_event, raw) => deps.projects.create(CreateProjectInputSchema.parse(raw).name));
  ipcMain.handle('projects:list', () => deps.projects.list());
  ipcMain.handle('projects:archive', (_event, raw) => deps.projects.archive(IdSchema.refine((id) => id.startsWith('project_')).parse(raw)));
  ipcMain.handle('settings:get', () => deps.configureAi.getPublicConfig());
  ipcMain.handle('settings:save', (_event, raw) => deps.configureAi.save(SaveProviderConfigInputSchema.parse(raw)));
  ipcMain.handle('settings:test', (_event, raw) => deps.configureAi.testConnection(SaveProviderConfigInputSchema.parse(raw)));
  ipcMain.handle('reviews:generate-daily', async (_event, raw) => {
    const input = GenerateDailyReviewInputSchema.parse(raw);
    const config = await deps.configureAi.getPublicConfig();
    return deps.generateDailyReview.execute({ ...input, model: config.model });
  });
  ipcMain.handle('reviews:list', () => deps.reviews.list());
  ipcMain.handle('reviews:cancel', () => { const task = deps.reviewTasks.getCurrent(); if (task) deps.reviewTasks.cancel(task.taskId); });
}
