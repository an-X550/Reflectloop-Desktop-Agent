import { access, mkdir, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { DataDirectoryInfo } from '../../../shared/schemas/domain';
import { appError } from '../../../shared/errors/app-error';

// S5：DataDirectoryInfo 已归位到 shared/schemas/domain.ts，此处保留再导出以兼容既有引用
export type { DataDirectoryInfo };

export class DataDirectoryService {
  constructor(private readonly root: string, private readonly openPath: (target: string) => Promise<string>) {}
  async getInfo(): Promise<DataDirectoryInfo> {
    await mkdir(this.root, { recursive: true });
    let writable = true; try { await access(this.root, constants.W_OK); } catch { writable = false; }
    const info: DataDirectoryInfo = { path: this.root, writable, fileCount: 0, totalBytes: 0, categories: { journals: 0, reviews: 0, projects: 0, profile: 0, settings: 0 } };
    const walk = async (folder: string, prefix = ''): Promise<void> => {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const target = path.join(folder, entry.name);
        if (entry.isDirectory()) await walk(target, relative);
        else if (entry.isFile()) {
          const category = relative === 'settings.json' ? 'settings' : relative.split('/')[0];
          if (!(category in info.categories)) continue;
          info.fileCount += 1; info.totalBytes += (await stat(target)).size;
          info.categories[category as keyof typeof info.categories] += 1;
        }
      }
    };
    await walk(this.root);
    return info;
  }
  async open(): Promise<void> { const error = await this.openPath(this.root); if (error) throw appError({ code: 'UNKNOWN', message: `无法打开数据文件夹：${error}` }); }
}
