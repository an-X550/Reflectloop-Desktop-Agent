import { app, dialog, safeStorage, shell } from 'electron';
import path from 'node:path';
import { CreateJournal, UpdateJournal } from './application/save-journal';
import { registerHandlers } from './ipc/register-handlers';
import { MarkdownJournalRepository } from './infrastructure/markdown/journal-repository';
import { JsonProjectRepository } from './infrastructure/markdown/project-repository';
import { CredentialStore } from './infrastructure/credentials/credential-store';
import { ConfigureAi } from './application/configure-ai';
import { MarkdownReviewRepository } from './infrastructure/markdown/review-repository';
import { ReviewTaskManager } from './domain/review-task';
import { GenerateDailyReview } from './application/generate-daily-review';
import { GeneratePeriodicReview } from './application/generate-periodic-review';
import { DataTransferService } from './infrastructure/transfer/data-transfer-service';
import { DataDirectoryService } from './infrastructure/data-directory/data-directory-service';
import { MarkdownProfileRepository } from './infrastructure/markdown/profile-repository';
import { GenerateInsightReview } from './application/generate-insight-review';
import { DailyAuditRecorder } from './skill-runtime/daily-audit-recorder';
import { VerifiedPatternRepository } from './infrastructure/patterns/verified-pattern-repository';
import { VerifiedPatternService } from './application/verified-patterns';

export function bootstrap() {
  const dataRoot = process.env.ZHIJI_DATA_ROOT ?? path.join(app.getPath('documents'), '知己');
  const trashItem = (target: string) => shell.trashItem(target);
  const journals = new MarkdownJournalRepository(dataRoot, trashItem);
  const projects = new JsonProjectRepository(dataRoot, trashItem);
  const credentials = new CredentialStore(app.getPath('userData'), safeStorage);
  const configureAi = new ConfigureAi(dataRoot, credentials, !app.isPackaged);
  const reviews = new MarkdownReviewRepository(dataRoot, trashItem);
  const reviewTasks = new ReviewTaskManager();
  const profile = new MarkdownProfileRepository(dataRoot);
  const generateDailyReview = new GenerateDailyReview(journals, reviews, configureAi, reviewTasks, undefined, profile, new DailyAuditRecorder(dataRoot));
  const generatePeriodicReview = new GeneratePeriodicReview(journals, reviews, configureAi, reviewTasks, undefined, profile);
  const generateInsightReview = new GenerateInsightReview(journals, reviews, configureAi, reviewTasks, undefined, profile);
  const verifiedPatterns = new VerifiedPatternService(reviews, new VerifiedPatternRepository(dataRoot), configureAi);
  const transfer = new DataTransferService(dataRoot, app.getVersion());
  const dataDirectory = new DataDirectoryService(dataRoot, (target) => shell.openPath(target));
  registerHandlers({ journals, projects, reviews, profile, reviewTasks, generateDailyReview, generatePeriodicReview, generateInsightReview, verifiedPatterns, createJournal: new CreateJournal(journals), updateJournal: new UpdateJournal(journals), configureAi, transfer, dataDirectory, dialog });
}
