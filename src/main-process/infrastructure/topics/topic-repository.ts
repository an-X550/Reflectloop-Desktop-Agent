import { readFile } from 'node:fs/promises';
import { TopicIndexSchema, type TopicIndex, type TopicIndexEntry } from '../../../shared/schemas/domain';
import { atomicWriteUtf8 } from '../markdown/atomic-write';
import { resolveInsideRoot } from '../markdown/path-policy';
import { appError } from '../../../shared/errors/app-error';

/** 主题名映射为文件名前去除路径分隔符与不合法字符，保证目标仍在 topics 目录内。 */
export function safeTopicName(title: string): string {
  const cleaned = title.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned || 'untitled';
}

export class TopicRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly root: string) {}

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue;
    let release!: () => void;
    this.writeQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async indexPath(): Promise<string> {
    return resolveInsideRoot(this.root, 'topics', 'index.json');
  }

  async listIndex(): Promise<TopicIndex> {
    try {
      return TopicIndexSchema.parse(JSON.parse(await readFile(await this.indexPath(), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 1, entries: [] };
      throw error;
    }
  }

  async getTopic(topic: string): Promise<string> {
    return readFile(await resolveInsideRoot(this.root, 'topics', `${safeTopicName(topic)}.md`), 'utf8');
  }

  /**
   * 保存主题；传入 expectedUpdatedAt 时，整个读改写在同一队列中执行，
   * 避免用户确认旧提案时覆盖另一窗口已经写入的新认识。
   * input.topic 只用于更新已有主题的规范文件名，展示标题仍可由归纳结果更新。
   */
  async saveTopic(input: { title: string; coreQuestion: string; aliases: string[]; body: string; topic?: string }, expectedUpdatedAt?: string | null): Promise<string> {
    return this.enqueue(async () => {
      const topic = safeTopicName(input.topic ?? input.title);
      const index = await this.listIndex();
      const current = index.entries.find((item) => item.topic === topic);
      if (expectedUpdatedAt !== undefined) {
        const unchanged = expectedUpdatedAt === null
          ? !current
          : current?.updatedAt === expectedUpdatedAt;
        if (!unchanged) throw appError({ code: 'FILE_CONFLICT', path: `topics/${topic}.md` });
      }
      await atomicWriteUtf8(await resolveInsideRoot(this.root, 'topics', `${topic}.md`), input.body, (value) => {
        if (!value.trim()) throw appError({ code: 'INVALID_INPUT', message: '主题正文不能为空。' });
      });
      const entry: TopicIndexEntry = {
        topic,
        title: input.title.trim().slice(0, 120),
        coreQuestion: input.coreQuestion.trim().slice(0, 500),
        aliases: input.aliases.map((alias) => alias.trim()).filter(Boolean).slice(0, 10),
        updatedAt: new Date().toISOString(),
      };
      const entries = [entry, ...index.entries.filter((item) => item.topic !== topic)];
      const next = TopicIndexSchema.parse({ schemaVersion: 1, entries });
      await atomicWriteUtf8(await this.indexPath(), JSON.stringify(next, null, 2), (value) => {
        TopicIndexSchema.parse(JSON.parse(value));
      });
      return topic;
    });
  }
}
