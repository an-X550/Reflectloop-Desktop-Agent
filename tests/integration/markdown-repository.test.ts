import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';

describe('MarkdownJournalRepository', () => {
  it('replaces an existing daily file without losing the updated journal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const base = { schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [] };
    await repository.save({ ...base, body: '旧内容' });
    await repository.save({ ...base, updatedAt: '2026-08-13T09:00:00.000Z', body: '新内容' });
    await expect(repository.get('journal_a1')).resolves.toMatchObject({ body: '新内容' });
  });
  it('round trips a journal through readable Markdown', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const journal = {
      schemaVersion: 1 as const,
      id: 'journal_a1',
      date: '2026-08-13',
      createdAt: '2026-08-13T10:00:00+08:00',
      updatedAt: '2026-08-13T10:00:00+08:00',
      projectIds: ['project_a1'],
      body: '今天完成了第一步。',
    };

    await repository.save(journal);
    await expect(repository.get(journal.id)).resolves.toEqual(journal);
    const markdown = await readFile(path.join(root, 'journals/2026/2026-08-13.md'), 'utf8');
    expect(markdown).toContain('id: journal_a1');
    expect(markdown).toContain('今天完成了第一步。');
  });

  it('rejects ids that can escape the data root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    await expect(repository.get('../outside')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
