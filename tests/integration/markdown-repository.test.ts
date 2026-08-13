import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';
import { MarkdownReviewRepository } from '../../src/main-process/infrastructure/markdown/review-repository';

describe('MarkdownJournalRepository', () => {
  it('creates two same-day journals without overwriting either entry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const base = { schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [] };
    await repository.create({ ...base, body: '第一条' });
    await repository.create({ ...base, id: 'journal_b2', body: '第二条' });

    await expect(repository.list()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'journal_a1', body: '第一条' }),
      expect.objectContaining({ id: 'journal_b2', body: '第二条' }),
    ]));
    await expect(readFile(path.join(root, 'journals/2026/2026-08-13--journal_a1.md'), 'utf8')).resolves.toContain('第一条');
    await expect(readFile(path.join(root, 'journals/2026/2026-08-13--journal_b2.md'), 'utf8')).resolves.toContain('第二条');
  });

  it('updates only the requested journal and rejects stale edits', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const first = { schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '第一条' };
    const second = { ...first, id: 'journal_b2', body: '第二条' };
    await repository.create(first);
    await repository.create(second);

    await repository.update({ ...first, body: '第一条已编辑', updatedAt: '2026-08-13T09:00:00.000Z' }, first.updatedAt);

    await expect(repository.get(first.id)).resolves.toMatchObject({ body: '第一条已编辑' });
    await expect(repository.get(second.id)).resolves.toMatchObject({ body: '第二条' });
    await expect(repository.update({ ...first, body: '过期修改', updatedAt: '2026-08-13T10:00:00.000Z' }, first.updatedAt)).rejects.toMatchObject({ code: 'FILE_CONFLICT' });
  });

  it('serializes concurrent updates so only one matching version succeeds', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const journal = { schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '原文' };
    await repository.create(journal);
    const results = await Promise.allSettled([
      repository.update({ ...journal, body: '版本一', updatedAt: '2026-08-13T09:00:00.000Z' }, journal.updatedAt),
      repository.update({ ...journal, body: '版本二', updatedAt: '2026-08-13T09:01:00.000Z' }, journal.updatedAt),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('reads legacy date files beside new id-addressed files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    const yearRoot = path.join(root, 'journals/2026');
    await mkdir(yearRoot, { recursive: true });
    await writeFile(path.join(yearRoot, '2026-08-12.md'), `---\nschema_version: 1\nid: journal_legacy\ndate: '2026-08-12'\ncreated_at: '2026-08-12T08:00:00.000Z'\nupdated_at: '2026-08-12T08:00:00.000Z'\nproject_ids: []\n---\n旧日志\n`, 'utf8');
    await repository.create({ schemaVersion: 1, id: 'journal_new', date: '2026-08-12', createdAt: '2026-08-12T09:00:00.000Z', updatedAt: '2026-08-12T09:00:00.000Z', projectIds: [], body: '新日志' });

    await expect(repository.list()).resolves.toHaveLength(2);
    await expect(repository.get('journal_legacy')).resolves.toMatchObject({ body: '旧日志' });
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

    await repository.create(journal);
    await expect(repository.get(journal.id)).resolves.toEqual(journal);
    const markdown = await readFile(path.join(root, 'journals/2026/2026-08-13--journal_a1.md'), 'utf8');
    expect(markdown).toContain('id: journal_a1');
    expect(markdown).toContain('今天完成了第一步。');
  });

  it('rejects ids that can escape the data root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const repository = new MarkdownJournalRepository(root);
    await expect(repository.get('../outside')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('moves only the selected journal file to the operating system trash', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-journal-'));
    const trashItem = vi.fn(async () => undefined);
    const repository = new MarkdownJournalRepository(root, trashItem);
    const journal = { schemaVersion: 1 as const, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '待删除日志' };
    await repository.create(journal);
    await repository.delete(journal.id);
    expect(trashItem).toHaveBeenCalledWith(path.join(root, 'journals/2026/2026-08-13--journal_a1.md'));
  });
});

describe('MarkdownReviewRepository', () => {
  it('moves only the selected review file to the operating system trash', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const trashItem = vi.fn(async () => undefined);
    const repository = new MarkdownReviewRepository(root, trashItem);
    const review = { schemaVersion: 1 as const, id: 'review_a1', type: 'weekly' as const, periodStart: '2026-08-10', periodEnd: '2026-08-16', sourceIds: ['journal_a1'], projectId: null, provider: 'openai-compatible' as const, model: 'test', promptVersion: 'weekly-v1', createdAt: '2026-08-16T08:00:00.000Z', body: '复盘' };
    await repository.save(review);
    await repository.delete(review.id);
    expect(trashItem).toHaveBeenCalledWith(path.join(root, 'reviews/weekly/2026/2026-08-10-review_a1.md'));
  });
});
