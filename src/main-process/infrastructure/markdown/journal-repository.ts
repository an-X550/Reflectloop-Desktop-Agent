import { readFile, readdir, rm } from 'node:fs/promises';
import matter from 'gray-matter';
import { JournalSchema, type Journal } from '../../../shared/schemas/domain';
import { appError } from '../../../shared/errors/app-error';
import { atomicWriteUtf8 } from './atomic-write';
import { resolveInsideRoot } from './path-policy';

function serialize(journal: Journal): string {
  const { body, schemaVersion, createdAt, updatedAt, projectIds, ...rest } = journal;
  return matter.stringify(body, {
    schema_version: schemaVersion,
    ...rest,
    created_at: createdAt,
    updated_at: updatedAt,
    project_ids: projectIds,
  });
}

function parse(markdown: string): Journal {
  const parsed = matter(markdown);
  return JournalSchema.parse({
    schemaVersion: parsed.data.schema_version,
    id: parsed.data.id,
    date: parsed.data.date,
    createdAt: parsed.data.created_at,
    updatedAt: parsed.data.updated_at,
    projectIds: parsed.data.project_ids ?? [],
    body: parsed.content.trim(),
  });
}

export class MarkdownJournalRepository {
  private updateQueue = Promise.resolve();
  constructor(private readonly root: string) {}

  private async entries(): Promise<Array<{ journal: Journal; filePath: string }>> {
    const entries: Array<{ journal: Journal; filePath: string }> = [];
    const ids = new Set<string>();
    const journalsRoot = await resolveInsideRoot(this.root, 'journals');
    try {
      for (const year of await readdir(journalsRoot)) {
        const yearRoot = await resolveInsideRoot(journalsRoot, year);
        for (const file of await readdir(yearRoot)) {
          if (!file.endsWith('.md')) continue;
          const filePath = await resolveInsideRoot(yearRoot, file);
          const journal = parse(await readFile(filePath, 'utf8'));
          if (ids.has(journal.id)) throw appError({ code: 'FILE_CONFLICT', path: filePath });
          ids.add(journal.id);
          entries.push({ journal, filePath });
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return entries;
  }

  async create(input: Journal): Promise<Journal> {
    const journal = JournalSchema.parse(input);
    const existing = (await this.entries()).find((entry) => entry.journal.id === journal.id);
    const target = await resolveInsideRoot(this.root, 'journals', journal.date.slice(0, 4), `${journal.date}--${journal.id}.md`);
    if (existing) throw appError({ code: 'FILE_CONFLICT', path: existing.filePath });
    const markdown = serialize(journal);
    await atomicWriteUtf8(target, markdown, (value) => parse(value));
    return journal;
  }

  async update(input: Journal, expectedUpdatedAt: string): Promise<Journal> {
    const operation = this.updateQueue.then(() => this.updateUnlocked(input, expectedUpdatedAt));
    this.updateQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async updateUnlocked(input: Journal, expectedUpdatedAt: string): Promise<Journal> {
    const journal = JournalSchema.parse(input);
    const existing = (await this.entries()).find((entry) => entry.journal.id === journal.id);
    if (!existing) throw appError({ code: 'NOT_FOUND', entity: journal.id });
    if (existing.journal.updatedAt !== expectedUpdatedAt) {
      throw appError({ code: 'FILE_CONFLICT', path: existing.filePath });
    }
    const target = existing.journal.date === journal.date
      ? existing.filePath
      : await resolveInsideRoot(this.root, 'journals', journal.date.slice(0, 4), `${journal.date}--${journal.id}.md`);
    await atomicWriteUtf8(target, serialize(journal), (value) => parse(value));
    if (target !== existing.filePath) await rm(existing.filePath, { force: true });
    return journal;
  }

  async get(id: string): Promise<Journal> {
    if (!/^journal_[a-z0-9]+$/.test(id)) {
      throw appError({ code: 'INVALID_INPUT', message: 'Invalid journal id.' });
    }
    const match = (await this.entries()).find((entry) => entry.journal.id === id);
    if (match) return match.journal;
    throw appError({ code: 'NOT_FOUND', entity: id });
  }

  async list(): Promise<Journal[]> {
    return (await this.entries()).map((entry) => entry.journal)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }
}
