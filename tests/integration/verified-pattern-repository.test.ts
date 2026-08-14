import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerifiedPatternRepository } from '../../src/main-process/infrastructure/patterns/verified-pattern-repository';

const pattern = {
  schemaVersion: 1 as const,
  id: 'pattern_a1b2',
  statement: '上午先关闭消息再开始核心交付时，更容易在当天看到进展',
  evidenceSummary: '两天的日反馈都提到上午专注后完成交付',
  sourceReviewIds: ['review_a1'],
  createdAt: '2026-08-13T10:00:00.000Z',
};

describe('VerifiedPatternRepository', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-patterns-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('returns an empty snapshot when the file does not exist', async () => {
    const repo = new VerifiedPatternRepository(root);
    const snapshot = await repo.list();
    expect(snapshot.patterns).toEqual([]);
  });

  it('persists a confirmed pattern atomically and rereads it', async () => {
    const repo = new VerifiedPatternRepository(root);
    await repo.add(pattern);
    const snapshot = await repo.list();
    expect(snapshot.patterns).toHaveLength(1);
    expect(snapshot.patterns[0]).toMatchObject({ id: 'pattern_a1b2', statement: pattern.statement });
    const raw = JSON.parse(await readFile(path.join(root, 'patterns', 'verified-patterns.json'), 'utf8'));
    expect(raw.patterns).toHaveLength(1);
  });

  it('appends without dropping previously confirmed patterns', async () => {
    const repo = new VerifiedPatternRepository(root);
    await repo.add(pattern);
    await repo.add({ ...pattern, id: 'pattern_c3d4', statement: '阅读前先写下问题和停止点时，不容易被学习感挤占' });
    const snapshot = await repo.list();
    expect(snapshot.patterns.map((item) => item.id)).toEqual(['pattern_a1b2', 'pattern_c3d4']);
  });

  it('rejects a corrupted snapshot instead of silently resetting it', async () => {
    await mkdir(path.join(root, 'patterns'), { recursive: true });
    await writeFile(path.join(root, 'patterns', 'verified-patterns.json'), 'not json', 'utf8');
    const repo = new VerifiedPatternRepository(root);
    await expect(repo.list()).rejects.toThrow();
  });

  it('refuses to persist a pattern that fails schema validation', async () => {
    const repo = new VerifiedPatternRepository(root);
    await expect(repo.add({ ...pattern, id: '../escape' })).rejects.toThrow();
    expect((await repo.list()).patterns).toEqual([]);
  });
});
