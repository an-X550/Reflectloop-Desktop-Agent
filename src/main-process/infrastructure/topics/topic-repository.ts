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
  constructor(private readonly root: string) {}

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

  async saveTopic(input: { title: string; coreQuestion: string; aliases: string[]; body: string }): Promise<string> {
    const topic = safeTopicName(input.title);
    await atomicWriteUtf8(await resolveInsideRoot(this.root, 'topics', `${topic}.md`), input.body, (value) => {
      if (!value.trim()) throw appError({ code: 'INVALID_INPUT', message: '主题正文不能为空。' });
    });
    const index = await this.listIndex();
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
  }
}
