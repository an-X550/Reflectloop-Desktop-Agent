import path from 'node:path';
import { access, constants, cp, readdir } from 'node:fs/promises';
import { appError } from '../../../shared/errors/app-error';
import type { DataRootConfig } from './data-root-config';

/**
 * 运行期数据根目录持有者：bootstrap 读一次后注入各仓储；
 * changeLocation 在运行期把现有数据迁到新位置并更新配置，下次启动生效。
 * 当前进程内的仓储仍指向旧路径——更改位置后必须重启。
 */
export class DataRootHolder {
  private current: string;
  constructor(private readonly config: DataRootConfig, initial: string) { this.current = initial; }

  get(): string { return this.current; }

  async changeLocation(target: string, options: { move: boolean }): Promise<{ moved: boolean; from: string; to: string }> {
    const normalized = path.resolve(target);
    if (normalized === this.current) throw appError({ code: 'INVALID_INPUT', message: '新位置与当前位置相同。' });
    await access(normalized, constants.W_OK).catch(() => { throw appError({ code: 'INVALID_INPUT', message: '目标位置不可写，请选择其他文件夹。' }); });
    const existing = await readdir(normalized).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [] as string[];
      throw error;
    });
    if (existing.some((name) => name !== '.DS_Store')) throw appError({ code: 'INVALID_INPUT', message: '目标文件夹非空，请选择空文件夹以避免覆盖。' });

    let moved = false;
    if (options.move) {
      // 递归复制现有数据到新位置；失败不破坏原数据。
      await cp(this.current, normalized, { recursive: true, force: true, errorOnExist: true, preserveTimestamps: true }).catch((error) => {
        throw appError({ code: 'UNKNOWN', message: `迁移失败，原数据未受影响：${error instanceof Error ? error.message : '请稍后重试'}` });
      });
      moved = true;
    }
    await this.config.patch({ dataRoot: normalized });
    return { moved, from: this.current, to: normalized };
  }
}
