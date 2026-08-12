import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
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
  constructor(private readonly root: string) {}

  async save(input: Journal): Promise<Journal> {
    const journal = JournalSchema.parse(input);
    const target = await resolveInsideRoot(this.root, 'journals', journal.date.slice(0, 4), `${journal.date}.md`);
    const markdown = serialize(journal);
    await atomicWriteUtf8(target, markdown, (value) => parse(value));
    return journal;
  }

  async get(id: string): Promise<Journal> {
    if (!/^journal_[a-z0-9]+$/.test(id)) {
      throw appError({ code: 'INVALID_INPUT', message: 'Invalid journal id.' });
    }
    const journalsRoot = await resolveInsideRoot(this.root, 'journals');
    try {
      for (const year of await readdir(journalsRoot)) {
        const yearRoot = await resolveInsideRoot(journalsRoot, year);
        for (const file of await readdir(yearRoot)) {
          if (!file.endsWith('.md')) continue;
          const journal = parse(await readFile(await resolveInsideRoot(yearRoot, file), 'utf8'));
          if (journal.id === id) return journal;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    throw appError({ code: 'NOT_FOUND', entity: id });
  }

  async list(): Promise<Journal[]> {
    const journals: Journal[] = [];
    const journalsRoot = await resolveInsideRoot(this.root, 'journals');
    try {
      for (const year of await readdir(journalsRoot)) {
        const yearRoot = await resolveInsideRoot(journalsRoot, year);
        for (const file of await readdir(yearRoot)) {
          if (file.endsWith('.md')) journals.push(parse(await readFile(await resolveInsideRoot(yearRoot, file), 'utf8')));
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return journals.sort((a, b) => a.date.localeCompare(b.date));
  }
}
