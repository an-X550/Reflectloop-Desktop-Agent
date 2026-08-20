import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { safeTopicName, TopicRepository } from '../../src/main-process/infrastructure/topics/topic-repository';

describe('safeTopicName', () => {
  it('strips path separators and unsafe characters', () => {
    expect(safeTopicName('../etc/passwd')).not.toMatch(/[/\\]/);
    // 全角标点（：？）是合法 Windows 文件名字符，应原样保留
    expect(safeTopicName('职业选择：化债下的行业？')).toBe('职业选择：化债下的行业？');
    expect(safeTopicName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('falls back to a stable placeholder when nothing safe remains', () => {
    expect(safeTopicName('///')).toBe('untitled');
  });
});

describe('TopicRepository', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-topics-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('returns an empty index when nothing has been saved', async () => {
    const repo = new TopicRepository(root);
    expect((await repo.listIndex()).entries).toEqual([]);
  });

  it('saves a topic atomically, updates the index and rereads both', async () => {
    const repo = new TopicRepository(root);
    await repo.saveTopic({ title: '职业选择', coreQuestion: '化债下选什么行业？', aliases: ['行业选择'], body: '# 职业选择\n\n当前判断：先验证再下注。' });
    const index = await repo.listIndex();
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({ topic: '职业选择', title: '职业选择', coreQuestion: '化债下选什么行业？', aliases: ['行业选择'] });
    expect(await repo.getTopic('职业选择')).toContain('当前判断：先验证再下注。');
    const raw = await readFile(path.join(root, 'topics', '职业选择.md'), 'utf8');
    expect(raw).toContain('先验证再下注');
  });

  it('updates an existing topic in place without duplicating the index entry', async () => {
    const repo = new TopicRepository(root);
    await repo.saveTopic({ title: '职业选择', coreQuestion: '旧问题', aliases: [], body: '旧正文' });
    await repo.saveTopic({ title: '职业选择', coreQuestion: '新问题', aliases: [], body: '新正文' });
    const index = await repo.listIndex();
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].coreQuestion).toBe('新问题');
    expect(await repo.getTopic('职业选择')).toBe('新正文');
  });

  it('rejects a stale conditional update and preserves the newer body', async () => {
    const repo = new TopicRepository(root);
    await repo.saveTopic({ title: '职业选择', coreQuestion: '旧问题', aliases: [], body: '旧正文' });
    const updatedAt = (await repo.listIndex()).entries[0].updatedAt;
    await repo.saveTopic({ title: '职业选择', coreQuestion: '新问题', aliases: [], body: '新正文' }, updatedAt);
    const newerUpdatedAt = (await repo.listIndex()).entries[0].updatedAt;
    await expect(repo.saveTopic({ title: '职业选择', coreQuestion: '过期问题', aliases: [], body: '过期正文' }, updatedAt)).rejects.toMatchObject({ code: 'FILE_CONFLICT' });
    expect((await repo.listIndex()).entries[0].updatedAt).toBe(newerUpdatedAt);
    expect(await repo.getTopic('职业选择')).toBe('新正文');
  });

  it('keeps the canonical topic file when an update changes the display title', async () => {
    const repo = new TopicRepository(root);
    await repo.saveTopic({ title: '职业选择', coreQuestion: '旧问题', aliases: ['行业选择'], body: '旧正文' });
    const updatedAt = (await repo.listIndex()).entries[0].updatedAt;
    const topic = await repo.saveTopic({ topic: '职业选择', title: '行业选择', coreQuestion: '新问题', aliases: [], body: '新正文' }, updatedAt);
    expect(topic).toBe('职业选择');
    expect(await repo.getTopic('职业选择')).toBe('新正文');
    await expect(repo.getTopic('行业选择')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('sanitizes unsafe titles before writing to disk', async () => {
    const repo = new TopicRepository(root);
    const saved = await repo.saveTopic({ title: 'a/b\\c', coreQuestion: 'q', aliases: [], body: 'body' });
    expect(saved).toBe('abc');
    expect(await repo.getTopic('abc')).toBe('body');
  });

  it('rejects a corrupted index instead of silently resetting it', async () => {
    await mkdir(path.join(root, 'topics'), { recursive: true });
    await writeFile(path.join(root, 'topics', 'index.json'), 'not json', 'utf8');
    const repo = new TopicRepository(root);
    await expect(repo.listIndex()).rejects.toThrow();
  });
});
