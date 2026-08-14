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
  }
}
