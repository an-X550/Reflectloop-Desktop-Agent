import { readdir, readFile, rm } from 'node:fs/promises';
import { TopicSessionSchema, type TopicSession } from '../../../shared/schemas/domain';
import { atomicWriteUtf8 } from '../markdown/atomic-write';
import { resolveInsideRoot } from '../markdown/path-policy';

/**
 * 主题讨论的最小文件型 checkpoint：每个会话一个 JSON 文件，应用重启后可恢复。
 */
export class TopicSessionStore {
  constructor(private readonly root: string) {}

  private async path(id: string): Promise<string> {
    return resolveInsideRoot(this.root, 'runtime', 'topic-sessions', `${id}.json`);
  }

  async save(session: TopicSession): Promise<void> {
    const validated = TopicSessionSchema.parse(session);
    await atomicWriteUtf8(await this.path(validated.id), JSON.stringify(validated, null, 2), (value) => {
      TopicSessionSchema.parse(JSON.parse(value));
    });
  }

  async load(id: string): Promise<TopicSession | null> {
    try {
      return TopicSessionSchema.parse(JSON.parse(await readFile(await this.path(id), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(): Promise<TopicSession[]> {
    let files: string[] = [];
    try {
      files = await readdir(await resolveInsideRoot(this.root, 'runtime', 'topic-sessions'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const sessions = await Promise.all(files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => TopicSessionSchema.parse(JSON.parse(await readFile(await resolveInsideRoot(this.root, 'runtime', 'topic-sessions', file), 'utf8')))));
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async remove(id: string): Promise<void> {
    await rm(await this.path(id), { force: true });
  }
}
