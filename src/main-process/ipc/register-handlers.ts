import { ipcMain, type dialog as ElectronDialog } from 'electron';
import { z } from 'zod';
import { CreateProjectInputSchema, GenerateDailyReviewInputSchema, IdSchema, JournalQuerySchema, PeriodicReviewInputSchema, SaveJournalInputSchema, SaveProviderConfigInputSchema } from '../../shared/schemas/ipc';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { JsonProjectRepository } from '../infrastructure/markdown/project-repository';
import type { SaveJournal } from '../application/save-journal';
import type { ConfigureAi } from '../application/configure-ai';
import type { GenerateDailyReview } from '../application/generate-daily-review';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import type { ReviewTaskManager } from '../domain/review-task';
import type { GeneratePeriodicReview } from '../application/generate-periodic-review';
import type { DataTransferService } from '../infrastructure/transfer/data-transfer-service';

export function registerHandlers(deps: { saveJournal: SaveJournal; journals: MarkdownJournalRepository; projects: JsonProjectRepository; configureAi: ConfigureAi; generateDailyReview: GenerateDailyReview; generatePeriodicReview: GeneratePeriodicReview; reviews: MarkdownReviewRepository; reviewTasks: ReviewTaskManager; transfer: DataTransferService; dialog: Pick<typeof ElectronDialog, 'showSaveDialog' | 'showOpenDialog'> }) {
  ipcMain.handle('transfer:export', async () => {
    const result = await deps.dialog.showSaveDialog({ title: '导出知己备份', defaultPath: `知己备份-${new Date().toISOString().slice(0, 10)}.zhiji.zip`, filters: [{ name: '知己备份', extensions: ['zip'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    const destination = result.filePath.endsWith('.zhiji.zip') ? result.filePath : `${result.filePath.replace(/\.zip$/i, '')}.zhiji.zip`;
    return { canceled: false, ...await deps.transfer.exportTo(destination) };
  });
  ipcMain.handle('transfer:preview-restore', async () => {
    const result = await deps.dialog.showOpenDialog({ title: '选择知己备份', properties: ['openFile'], filters: [{ name: '知己备份', extensions: ['zip'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, ...await deps.transfer.preview(result.filePaths[0]) };
  });
  ipcMain.handle('transfer:restore', (_event, raw) => deps.transfer.restore(z.string().uuid().parse(raw)));
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
  ipcMain.handle('reviews:preview', async (_event, raw) => { const input = PeriodicReviewInputSchema.omit({ previewToken: true }).parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generatePeriodicReview.preview({ ...input, model: config.model }); });
  ipcMain.handle('reviews:generate-periodic', async (_event, raw) => { const input = PeriodicReviewInputSchema.required({ previewToken: true }).parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generatePeriodicReview.execute({ ...input, previewToken: input.previewToken, model: config.model }); });
}
