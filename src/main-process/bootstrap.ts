import { app } from 'electron';
import path from 'node:path';
import { SaveJournal } from './application/save-journal';
import { registerHandlers } from './ipc/register-handlers';
import { MarkdownJournalRepository } from './infrastructure/markdown/journal-repository';
import { JsonProjectRepository } from './infrastructure/markdown/project-repository';

export function bootstrap() {
  const dataRoot = process.env.ZHIJI_DATA_ROOT ?? path.join(app.getPath('documents'), '知己');
  const journals = new MarkdownJournalRepository(dataRoot);
  const projects = new JsonProjectRepository(dataRoot);
  registerHandlers({ journals, projects, saveJournal: new SaveJournal(journals) });
}
