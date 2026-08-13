import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataDirectoryService } from '../../src/main-process/infrastructure/data-directory/data-directory-service';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('DataDirectoryService', () => {
  it('reports the actual root and portable data counts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-data-info-')); roots.push(root);
    await mkdir(path.join(root, 'journals', '2026'), { recursive: true });
    await writeFile(path.join(root, 'journals', '2026', '2026-08-13.md'), 'journal');
    await writeFile(path.join(root, 'settings.json'), '{}');
    const info = await new DataDirectoryService(root, async () => '').getInfo();
    expect(info).toMatchObject({ path: root, writable: true, fileCount: 2, categories: { journals: 1, settings: 1 } });
  });

  it('opens only its configured root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zhiji-data-open-')); roots.push(root);
    const openPath = vi.fn(async () => '');
    await new DataDirectoryService(root, openPath).open();
    expect(openPath).toHaveBeenCalledWith(root);
  });
});
