import crypto from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { ProjectSchema, type Project } from '../../../shared/schemas/domain';
import { appError } from '../../../shared/errors/app-error';
import { atomicWriteUtf8 } from './atomic-write';
import { resolveInsideRoot } from './path-policy';

export class JsonProjectRepository {
  constructor(private readonly root: string) {}

  async create(name: string): Promise<Project> {
    const now = new Date().toISOString();
    const project = ProjectSchema.parse({ schemaVersion: 1, id: `project_${crypto.randomUUID().replaceAll('-', '')}`, name, status: 'active', createdAt: now, archivedAt: null });
    return this.save(project);
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
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw appError({ code: 'NOT_FOUND', entity: id });
    return this.save({ ...project, status: 'archived', archivedAt: new Date().toISOString() });
  }
}
