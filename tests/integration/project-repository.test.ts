import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { JsonProjectRepository } from '../../src/main-process/infrastructure/markdown/project-repository';

describe('JsonProjectRepository lifecycle', () => {
  it('rejects duplicate names across active and archived projects', async () => {
    const repository = new JsonProjectRepository(await mkdtemp(path.join(tmpdir(), 'zhiji-project-')), vi.fn());
    const first = await repository.create('求职准备');
    await repository.archive(first.id);
    await expect(repository.create('  求职准备  ')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('renames and restores a project while preserving its stable id', async () => {
    const repository = new JsonProjectRepository(await mkdtemp(path.join(tmpdir(), 'zhiji-project-')), vi.fn());
    const first = await repository.create('旧名称');
    await expect(repository.rename(first.id, '新名称')).resolves.toMatchObject({ id: first.id, name: '新名称' });
    await repository.archive(first.id);
    await expect(repository.restore(first.id)).resolves.toMatchObject({ id: first.id, status: 'active', archivedAt: null });
  });

  it('moves an unreferenced project file to the operating system trash', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-project-'));
    const trashItem = vi.fn(async () => undefined);
    const repository = new JsonProjectRepository(root, trashItem);
    const first = await repository.create('临时项目');
    await repository.delete(first.id);
    expect(trashItem).toHaveBeenCalledWith(path.join(root, 'projects', `${first.id}.json`));
  });
});
