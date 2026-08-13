import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { DataTransferService } from '../../src/main-process/infrastructure/transfer/data-transfer-service';

const roots: string[] = [];
async function temp(name: string) { const root = await mkdtemp(path.join(os.tmpdir(), name)); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('DataTransferService', () => {
  it('exports only portable data with a versioned checksum manifest', async () => {
    const source = await temp('zhiji-export-');
    await mkdir(path.join(source, 'journals', '2026'), { recursive: true });
    await writeFile(path.join(source, 'journals', '2026', '2026-08-13.md'), `---\nschema_version: 1\nid: journal_a1\ndate: '2026-08-13'\ncreated_at: '2026-08-13T00:00:00.000Z'\nupdated_at: '2026-08-13T00:00:00.000Z'\nproject_ids: []\n---\njournal\n`);
    await writeFile(path.join(source, 'settings.json'), '{"providerId":"openai","baseUrl":"https://api.openai.com/v1","model":"safe"}');
    await mkdir(path.join(source, '.cache'), { recursive: true });
    await writeFile(path.join(source, '.cache', 'secret.txt'), 'sk-secret');
    await writeFile(path.join(source, 'credentials.enc'), 'encrypted-key');
    const archive = path.join(await temp('zhiji-destination-'), 'backup.zhiji.zip');

    const result = await new DataTransferService(source, '1.0.0').exportTo(archive);
    const zip = new AdmZip(archive);
    const names = zip.getEntries().map((entry) => entry.entryName);
    expect(names).toContain('manifest.json');
    expect(names).toContain('journals/2026/2026-08-13.md');
    expect(names).toContain('settings.json');
    expect(names.join('\n')).not.toMatch(/cache|credential|secret/i);
    expect(result.fileCount).toBe(2);
    expect(JSON.parse(zip.readAsText('manifest.json'))).toMatchObject({ formatVersion: 1, appVersion: '1.0.0' });
  });

  it('previews and restores a verified archive only into an empty data root', async () => {
    const source = await temp('zhiji-source-');
    await mkdir(path.join(source, 'projects'), { recursive: true });
    await writeFile(path.join(source, 'projects', 'project_a1.json'), JSON.stringify({ schemaVersion: 1, id: 'project_a1', name: '项目', status: 'active', createdAt: '2026-08-13T00:00:00.000Z', archivedAt: null }));
    const archive = path.join(await temp('zhiji-archive-'), 'backup.zhiji.zip');
    await new DataTransferService(source, '1.0.0').exportTo(archive);
    const target = await temp('zhiji-target-');
    const service = new DataTransferService(target, '1.0.0');

    const preview = await service.preview(archive);
    expect(preview).toMatchObject({ fileCount: 1, categories: { projects: 1 } });
    await service.restore(preview.previewId);
    expect(await readFile(path.join(target, 'projects', 'project_a1.json'), 'utf8')).toContain('project_a1');
    await expect(service.preview(archive).then((next) => service.restore(next.previewId))).rejects.toThrow(/非空|已有数据/);
  });

  it('rejects Zip Slip paths and checksum changes before writing', async () => {
    const target = await temp('zhiji-malicious-target-');
    const archiveRoot = await temp('zhiji-malicious-archive-');
    const archive = path.join(archiveRoot, 'malicious.zhiji.zip');
    const zip = new AdmZip();
    zip.addFile('../outside.md', Buffer.from('escape'));
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), appVersion: '1.0.0', files: [{ path: '../outside.md', sha256: '0'.repeat(64), size: 6 }] })));
    zip.writeZip(archive);
    await expect(new DataTransferService(target, '1.0.0').preview(archive)).rejects.toThrow(/路径|压缩包/);
    await expect(readFile(path.join(archiveRoot, 'outside.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a checksum-valid archive containing an invalid project', async () => {
    const source = await temp('zhiji-invalid-source-'); const archive = path.join(await temp('zhiji-invalid-archive-'), 'invalid.zhiji.zip'); const zip = new AdmZip(); const content = Buffer.from('{"id":"project_a1"}');
    zip.addFile('projects/project_a1.json', content); zip.addFile('manifest.json', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), appVersion: '1.0.0', files: [{ path: 'projects/project_a1.json', sha256: crypto.createHash('sha256').update(content).digest('hex'), size: content.byteLength }] }))); zip.writeZip(archive);
    await expect(new DataTransferService(source, '1.0.0').preview(archive)).rejects.toThrow(/project_a1|项目/);
  });

  it('exports the personal profile but not credential-like files', async () => {
    const source = await temp('zhiji-profile-export-'); await mkdir(path.join(source, 'profile'), { recursive: true });
    await writeFile(path.join(source, 'profile', 'about-me.md'), `---\nschema_version: 1\nenabled_for_ai: false\ncreated_at: '2026-08-13T00:00:00.000Z'\nupdated_at: '2026-08-13T00:00:00.000Z'\n---\n个人背景\n`); await writeFile(path.join(source, 'credentials.json'), 'sk-secret');
    const archive = path.join(await temp('zhiji-profile-destination-'), 'backup.zhiji.zip'); await new DataTransferService(source, '1.0.0').exportTo(archive);
    const names = new AdmZip(archive).getEntries().map((entry) => entry.entryName); expect(names).toContain('profile/about-me.md'); expect(names.join('\n')).not.toMatch(/credential|api.?key/i);
  });
});
