import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopicSessionStore } from '../../src/main-process/infrastructure/topics/topic-session-store';
import type { TopicSession } from '../../src/shared/schemas/domain';

const session = (id: string, updatedAt = '2026-08-14T10:00:00.000Z'): TopicSession => ({
  schemaVersion: 1,
  id,
  question: '我应该现在换工作吗？',
  referencedTopics: [],
  messages: [
    { role: 'user', content: '我应该现在换工作吗？', at: '2026-08-14T09:00:00.000Z' },
    { role: 'assistant', content: '先看现金流约束。', at: '2026-08-14T09:01:00.000Z' },
  ],
  createdAt: '2026-08-14T09:00:00.000Z',
  updatedAt,
});

describe('TopicSessionStore', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-topic-sessions-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('saves and reloads a session through a fresh store instance (restart recovery)', async () => {
    const first = new TopicSessionStore(root);
    await first.save(session('topicsession_a1'));
    const afterRestart = new TopicSessionStore(root);
    const recovered = await afterRestart.load('topicsession_a1');
    expect(recovered?.messages).toHaveLength(2);
    expect(recovered?.question).toBe('我应该现在换工作吗？');
  });

  it('lists saved sessions newest first and removes them after confirmation', async () => {
    const store = new TopicSessionStore(root);
    await store.save(session('topicsession_old', '2026-08-13T10:00:00.000Z'));
    await store.save(session('topicsession_new', '2026-08-14T10:00:00.000Z'));
    const sessions = await store.list();
    expect(sessions.map((item) => item.id)).toEqual(['topicsession_new', 'topicsession_old']);
    await store.remove('topicsession_new');
    expect((await store.list()).map((item) => item.id)).toEqual(['topicsession_old']);
    expect(await store.load('topicsession_new')).toBeNull();
  });

  it('rejects a corrupted checkpoint instead of silently dropping it', async () => {
    await mkdir(path.join(root, 'runtime', 'topic-sessions'), { recursive: true });
    await writeFile(path.join(root, 'runtime', 'topic-sessions', 'topicsession_bad.json'), 'not json', 'utf8');
    const store = new TopicSessionStore(root);
    await expect(store.load('topicsession_bad')).rejects.toThrow();
  });

  it('refuses to persist a session that fails schema validation', async () => {
    const store = new TopicSessionStore(root);
    await expect(store.save({ ...session('topicsession_a1'), id: '../escape' } as never)).rejects.toThrow();
  });
});
