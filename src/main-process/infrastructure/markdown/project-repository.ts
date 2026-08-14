import crypto from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { ProjectSchema, type Project } from '../../../shared/schemas/domain';
import { appError } from '../../../shared/errors/app-error';
import { atomicWriteUtf8 } from './atomic-write';
import { resolveInsideRoot } from './path-policy';

export class JsonProjectRepository {
  constructor(private readonly root: string, private readonly trashItem?: (target: string) => Promise<void>) {}

  /** 读-改-写串行化：唯一性检查与落盘之间不允许另一个写操作插入。 */
  private queue: Promise<unknown> = Promise.resolve();
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private nameKey(name: string) { return name.trim().toLocaleLowerCase(); }
  private async assertUnique(name: string, exceptId?: string) {
    if ((await this.list()).some((item) => item.id !== exceptId && this.nameKey(item.name) === this.nameKey(name))) throw appError({ code: 'INVALID_INPUT', message: '项目名称已存在。' });
  }

  async create(name: string): Promise<Project> {
    return this.enqueue(async () => {
      await this.assertUnique(name);
      const now = new Date().toISOString();
      const project = ProjectSchema.parse({ schemaVersion: 1, id: `project_${crypto.randomUUID().replaceAll('-', '')}`, name, status: 'active', createdAt: now, archivedAt: null });
      return this.save(project);
    });
  }

  async save(project: Project): Promise<Project> {
    const valid = ProjectSchema.parse(project);
    const target = await resolveInsideRoot(this.root, 'projects', `${valid.id}.json`);
    const content = `${JSON.stringify(valid, null, 2)}\n`;
    await atomicWriteUtf8(target, content, (value) => ProjectSchema.parse(JSON.parse(value)));
    return valid;
  }

  async list(): Promise<Project[]> {
    const root = await resolveInsideRoot(this.root, 'projects');
    try {
      const result = await Promise.all((await readdir(root)).filter((file) => file.endsWith('.json')).map(async (file) => ProjectSchema.parse(JSON.parse(await readFile(await resolveInsideRoot(root, file), 'utf8')))));
      return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async archive(id: string): Promise<Project> {
    return this.enqueue(async () => {
      const project = (await this.list()).find((item) => item.id === id);
      if (!project) throw appError({ code: 'NOT_FOUND', entity: id });
      return this.save({ ...project, status: 'archived', archivedAt: new Date().toISOString() });
    });
  }

  async rename(id: string, name: string): Promise<Project> {
    return this.enqueue(async () => {
      const project = (await this.list()).find((item) => item.id === id);
      if (!project) throw appError({ code: 'NOT_FOUND', entity: id });
      await this.assertUnique(name, id);
      return this.save({ ...project, name: name.trim() });
    });
  }

  async restore(id: string): Promise<Project> {
    return this.enqueue(async () => {
      const project = (await this.list()).find((item) => item.id === id);
      if (!project) throw appError({ code: 'NOT_FOUND', entity: id });
      return this.save({ ...project, status: 'active', archivedAt: null });
    });
  }

  async delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      const project = (await this.list()).find((item) => item.id === id);
      if (!project) throw appError({ code: 'NOT_FOUND', entity: id });
      const trash = this.trashItem;
      if (!trash) throw appError({ code: 'UNKNOWN', message: '系统回收站当前不可用。' });
      await trash(await resolveInsideRoot(this.root, 'projects', `${id}.json`));
    });
  }
}
