import crypto from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { ArchiveManifestSchema, assertPortablePath, isPortablePath, type ArchiveManifest } from './archive-manifest';

type Preview = { previewId: string; archivePath: string; exportedAt: string; appVersion: string; fileCount: number; totalBytes: number; categories: { journals: number; reviews: number; projects: number; settings: number } };
const digest = (value: Buffer) => crypto.createHash('sha256').update(value).digest('hex');

async function listPortableFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  async function walk(folder: string, prefix: string): Promise<void> {
    try {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const target = path.join(folder, entry.name);
        if (entry.isDirectory()) await walk(target, relative);
        else if (entry.isFile() && isPortablePath(relative)) output.push(relative);
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  await walk(root, '');
  return output.sort();
}

export class DataTransferService {
  private readonly previews = new Map<string, Preview>();
  constructor(private readonly dataRoot: string, private readonly appVersion: string) {}

  async exportTo(destination: string): Promise<{ path: string; fileCount: number; totalBytes: number }> {
    const files = await listPortableFiles(this.dataRoot);
    const zip = new AdmZip();
    const manifest: ArchiveManifest = { formatVersion: 1, exportedAt: new Date().toISOString(), appVersion: this.appVersion, files: [] };
    for (const relative of files) {
      const content = await readFile(path.join(this.dataRoot, ...relative.split('/')));
      manifest.files.push({ path: relative, sha256: digest(content), size: content.byteLength });
      zip.addFile(relative, content);
    }
    zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    try { zip.writeZip(temporary); await this.validateArchive(temporary); await rename(temporary, destination); }
    finally { await rm(temporary, { force: true }); }
    return { path: destination, fileCount: files.length, totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0) };
  }

  async preview(archivePath: string): Promise<Preview> {
    const manifest = await this.validateArchive(archivePath);
    const preview: Preview = { previewId: crypto.randomUUID(), archivePath, exportedAt: manifest.exportedAt, appVersion: manifest.appVersion, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((sum, file) => sum + file.size, 0), categories: { journals: 0, reviews: 0, projects: 0, settings: 0 } };
    for (const file of manifest.files) {
      if (file.path === 'settings.json') preview.categories.settings += 1;
      else preview.categories[file.path.split('/')[0] as 'journals' | 'reviews' | 'projects'] += 1;
    }
    this.previews.set(preview.previewId, preview);
    return preview;
  }

  async restore(previewId: string): Promise<{ fileCount: number }> {
    const preview = this.previews.get(previewId);
    if (!preview) throw new Error('恢复预览已失效，请重新选择备份。');
    this.previews.delete(previewId);
    const manifest = await this.validateArchive(preview.archivePath);
    await mkdir(this.dataRoot, { recursive: true });
    if ((await readdir(this.dataRoot)).some((name) => name !== '.DS_Store')) throw new Error('当前数据目录非空；为避免覆盖已有数据，只能恢复到空目录。');
    const staging = await mkdtemp(path.join(path.dirname(this.dataRoot), '.zhiji-restore-'));
    const backup = `${this.dataRoot}.empty-${crypto.randomUUID()}`;
    try {
      const zip = new AdmZip(preview.archivePath);
      for (const file of manifest.files) {
        const entry = zip.getEntry(file.path)!;
        const target = path.join(staging, ...file.path.split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, entry.getData());
      }
      await rename(this.dataRoot, backup);
      try { await rename(staging, this.dataRoot); }
      catch (error) { await rename(backup, this.dataRoot); throw error; }
      await rm(backup, { recursive: true, force: true });
      return { fileCount: manifest.files.length };
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  private async validateArchive(archivePath: string): Promise<ArchiveManifest> {
    if (!(await stat(archivePath)).isFile()) throw new Error('备份文件无效。');
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();
    const manifestEntry = entries.find((entry) => entry.entryName === 'manifest.json');
    if (!manifestEntry || manifestEntry.isDirectory) throw new Error('压缩包缺少清单。');
    const manifest = ArchiveManifestSchema.parse(JSON.parse(manifestEntry.getData().toString('utf8')));
    const expected = new Set(manifest.files.map((file) => file.path));
    if (expected.size !== manifest.files.length) throw new Error('压缩包清单包含重复路径。');
    for (const entry of entries) {
      if (entry.entryName === 'manifest.json' || entry.isDirectory) continue;
      assertPortablePath(entry.entryName);
      if (!expected.has(entry.entryName)) throw new Error(`压缩包包含未登记文件：${entry.entryName}`);
    }
    for (const file of manifest.files) {
      assertPortablePath(file.path);
      const entry = zip.getEntry(file.path);
      if (!entry || entry.isDirectory) throw new Error(`压缩包缺少文件：${file.path}`);
      const content = entry.getData();
      if (content.byteLength !== file.size || digest(content) !== file.sha256) throw new Error(`压缩包校验失败：${file.path}`);
    }
    return manifest;
  }
}
