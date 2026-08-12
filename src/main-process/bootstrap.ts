import { app, safeStorage } from 'electron';
import path from 'node:path';
import { SaveJournal } from './application/save-journal';
import { registerHandlers } from './ipc/register-handlers';
import { MarkdownJournalRepository } from './infrastructure/markdown/journal-repository';
import { JsonProjectRepository } from './infrastructure/markdown/project-repository';
import { CredentialStore } from './infrastructure/credentials/credential-store';
import { ConfigureAi } from './application/configure-ai';

export function bootstrap() {
  const dataRoot = process.env.ZHIJI_DATA_ROOT ?? path.join(app.getPath('documents'), '知己');
  const journals = new MarkdownJournalRepository(dataRoot);
  const projects = new JsonProjectRepository(dataRoot);
  const credentials = new CredentialStore(app.getPath('userData'), safeStorage);
  const configureAi = new ConfigureAi(dataRoot, credentials, !app.isPackaged);
  registerHandlers({ journals, projects, saveJournal: new SaveJournal(journals), configureAi });
}
