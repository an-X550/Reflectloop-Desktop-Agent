import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CreateJournal, UpdateJournal } from '../../src/main-process/application/save-journal';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';

describe('journal commands', () => {
  it('creates independent ids for repeated same-day entries', async () => {
    const repository = new MarkdownJournalRepository(await mkdtemp(path.join(tmpdir(), 'zhiji-command-')));
    const create = new CreateJournal(repository, () => new Date('2026-08-13T04:00:00.000Z'));

    const first = await create.execute({ date: '2026-08-13', body: '第一条', projectIds: [] });
    const second = await create.execute({ date: '2026-08-13', body: '第二条', projectIds: [] });

    expect(first.id).not.toBe(second.id);
    await expect(repository.list()).resolves.toHaveLength(2);
  });

  it('rejects future entries and stale updates', async () => {
    const repository = new MarkdownJournalRepository(await mkdtemp(path.join(tmpdir(), 'zhiji-command-')));
    const now = () => new Date('2026-08-13T04:00:00.000Z');
    const create = new CreateJournal(repository, now);
    const update = new UpdateJournal(repository, now);

    await expect(create.execute({ date: '2026-08-14', body: '未来', projectIds: [] })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const journal = await create.execute({ date: '2026-08-12', body: '过去', projectIds: [] });
    await expect(update.execute({ id: journal.id, date: journal.date, body: '编辑', projectIds: [], expectedUpdatedAt: '2026-08-12T00:00:00.000Z' })).rejects.toMatchObject({ code: 'FILE_CONFLICT' });
  });
});
