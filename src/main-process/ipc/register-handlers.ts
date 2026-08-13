import { ipcMain, type dialog as ElectronDialog } from 'electron';
import { z } from 'zod';
import { CreateJournalInputSchema, CreateProjectInputSchema, GenerateDailyReviewInputSchema, IdSchema, InsightReviewGenerateInputSchema, InsightReviewPreviewInputSchema, JournalQuerySchema, PeriodicReviewGenerateInputSchema, PeriodicReviewPreviewInputSchema, RenameProjectInputSchema, SaveProfileInputSchema, SaveProviderConfigInputSchema, UpdateJournalInputSchema } from '../../shared/schemas/ipc';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { JsonProjectRepository } from '../infrastructure/markdown/project-repository';
import type { CreateJournal, UpdateJournal } from '../application/save-journal';
import type { ConfigureAi } from '../application/configure-ai';
import type { GenerateDailyReview } from '../application/generate-daily-review';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import type { ReviewTaskManager } from '../domain/review-task';
import type { GeneratePeriodicReview } from '../application/generate-periodic-review';
import type { DataTransferService } from '../infrastructure/transfer/data-transfer-service';
import type { DataDirectoryService } from '../infrastructure/data-directory/data-directory-service';
import type { GenerateInsightReview } from '../application/generate-insight-review';

export function registerHandlers(deps: { createJournal: CreateJournal; updateJournal: UpdateJournal; journals: MarkdownJournalRepository; projects: JsonProjectRepository; profile: MarkdownProfileRepository; configureAi: ConfigureAi; generateDailyReview: GenerateDailyReview; generatePeriodicReview: GeneratePeriodicReview; generateInsightReview: GenerateInsightReview; reviews: MarkdownReviewRepository; reviewTasks: ReviewTaskManager; transfer: DataTransferService; dataDirectory: DataDirectoryService; dialog: Pick<typeof ElectronDialog, 'showSaveDialog' | 'showOpenDialog'> }) {
  ipcMain.handle('data-directory:get-info', () => deps.dataDirectory.getInfo());
  ipcMain.handle('data-directory:open', () => deps.dataDirectory.open());
  ipcMain.handle('profile:get', () => deps.profile.get()); ipcMain.handle('profile:save', (_event, raw) => deps.profile.save(SaveProfileInputSchema.parse(raw))); ipcMain.handle('profile:clear', () => deps.profile.clear());
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
  ipcMain.handle('journals:create', (_event, raw) => deps.createJournal.execute(CreateJournalInputSchema.parse(raw)));
  ipcMain.handle('journals:update', (_event, raw) => deps.updateJournal.execute(UpdateJournalInputSchema.parse(raw)));
  ipcMain.handle('journals:list', async (_event, raw = {}) => {
    const query = JournalQuerySchema.parse(raw);
    return (await deps.journals.list()).filter((item) => (!query.start || item.date >= query.start) && (!query.end || item.date <= query.end) && (!query.projectId || item.projectIds.includes(query.projectId)));
  });
  ipcMain.handle('journals:get', (_event, raw) => deps.journals.get(IdSchema.parse(raw)));
  ipcMain.handle('journals:delete', (_event, raw) => deps.journals.delete(IdSchema.refine((id) => id.startsWith('journal_')).parse(raw)));
  ipcMain.handle('projects:create', (_event, raw) => deps.projects.create(CreateProjectInputSchema.parse(raw).name));
  ipcMain.handle('projects:list', () => deps.projects.list());
  ipcMain.handle('projects:archive', (_event, raw) => deps.projects.archive(IdSchema.refine((id) => id.startsWith('project_')).parse(raw)));
  ipcMain.handle('projects:rename', (_event, raw) => { const input = RenameProjectInputSchema.parse(raw); return deps.projects.rename(input.id, input.name); });
  ipcMain.handle('projects:restore', (_event, raw) => deps.projects.restore(IdSchema.refine((id) => id.startsWith('project_')).parse(raw)));
  ipcMain.handle('projects:delete', async (_event, raw) => { const id = IdSchema.refine((value) => value.startsWith('project_')).parse(raw); if ((await deps.journals.list()).some((journal) => journal.projectIds.includes(id))) throw new Error('有关联日志，不能删除项目。'); await deps.projects.delete(id); });
  ipcMain.handle('settings:get', () => deps.configureAi.getPublicConfig());
  ipcMain.handle('settings:save', (_event, raw) => deps.configureAi.save(SaveProviderConfigInputSchema.parse(raw)));
  ipcMain.handle('settings:test', (_event, raw) => deps.configureAi.testConnection(SaveProviderConfigInputSchema.parse(raw)));
  ipcMain.handle('settings:clear-api-key', () => deps.configureAi.clearApiKey());
  ipcMain.handle('reviews:generate-daily', async (_event, raw) => {
    const input = GenerateDailyReviewInputSchema.parse(raw);
    const config = await deps.configureAi.getPublicConfig();
    return deps.generateDailyReview.execute({ ...input, model: config.model });
  });
  ipcMain.handle('reviews:list', () => deps.reviews.list());
  ipcMain.handle('reviews:delete', (_event, raw) => deps.reviews.delete(z.string().regex(/^review_[a-z0-9]+$/).parse(raw)));
  ipcMain.handle('reviews:cancel', () => { const task = deps.reviewTasks.getCurrent(); if (task) deps.reviewTasks.cancel(task.taskId); });
  ipcMain.handle('reviews:preview', async (_event, raw) => { const input = PeriodicReviewPreviewInputSchema.parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generatePeriodicReview.preview({ ...input, model: config.model }); });
  ipcMain.handle('reviews:generate-periodic', async (_event, raw) => { const input = PeriodicReviewGenerateInputSchema.parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generatePeriodicReview.execute({ ...input, model: config.model }); });
  ipcMain.handle('reviews:preview-insight', async (_event, raw) => { const input = InsightReviewPreviewInputSchema.parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generateInsightReview.preview({ ...input, model: config.model }); });
  ipcMain.handle('reviews:generate-insight', async (_event, raw) => { const input = InsightReviewGenerateInputSchema.parse(raw); const config = await deps.configureAi.getPublicConfig(); return deps.generateInsightReview.execute({ ...input, model: config.model }); });
}
