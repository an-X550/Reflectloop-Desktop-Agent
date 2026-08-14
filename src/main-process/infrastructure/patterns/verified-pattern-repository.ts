import { readFile } from 'node:fs/promises';
import { VerifiedPatternSchema, VerifiedPatternSnapshotSchema, type VerifiedPattern, type VerifiedPatternSnapshot } from '../../../shared/schemas/domain';
import { atomicWriteUtf8 } from '../markdown/atomic-write';
import { resolveInsideRoot } from '../markdown/path-policy';

/**
 * 已确认验证模式的单一 JSON 当前状态快照。
 * 只有用户明确确认的候选才进入快照；快照损坏时抛错而不是静默重置。
 */
export class VerifiedPatternRepository {
  constructor(private readonly root: string) {}

  /** 读-改-写串行化：读取快照与追加写入之间不允许另一个写入插入。 */
  private queue: Promise<unknown> = Promise.resolve();

  private async target(): Promise<string> {
    return resolveInsideRoot(this.root, 'patterns', 'verified-patterns.json');
  }

  async list(): Promise<VerifiedPatternSnapshot> {
    try {
      return VerifiedPatternSnapshotSchema.parse(JSON.parse(await readFile(await this.target(), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), patterns: [] };
      }
      throw error;
    }
  }

  async add(pattern: VerifiedPattern): Promise<VerifiedPatternSnapshot> {
    const task = this.queue.then(async () => {
      const validated = VerifiedPatternSchema.parse(pattern);
      const current = await this.list();
      const next = VerifiedPatternSnapshotSchema.parse({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        patterns: [...current.patterns, validated],
      });
      await atomicWriteUtf8(await this.target(), JSON.stringify(next, null, 2), (value) => {
        VerifiedPatternSnapshotSchema.parse(JSON.parse(value));
      });
      return this.list();
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
