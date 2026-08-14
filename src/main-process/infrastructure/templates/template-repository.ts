import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appError } from '../../../shared/errors/app-error';
import { resolveInsideRoot } from '../markdown/path-policy';

export interface JournalTemplate { name: string; body: string }

const NAME_PATTERN = /^[^/\\:*?"<>|]{1,40}$/;

/** 日志模板：存放在 <dataRoot>/templates/<name>.md；文件名即模板名，正文即模板内容。 */
export class TemplateRepository {
  constructor(private readonly root: string) {}

  private async dir(): Promise<string> { return resolveInsideRoot(this.root, 'templates'); }

  async list(): Promise<JournalTemplate[]> {
    const dir = await this.dir();
    try {
      const files = (await readdir(dir)).filter((file) => file.endsWith('.md'));
      const entries = await Promise.all(files.map(async (file) => {
        const name = file.slice(0, -3);
        const body = await readFile(path.join(dir, file), 'utf8');
        return { name, body } satisfies JournalTemplate;
      }));
      return entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async get(name: string): Promise<JournalTemplate> {
    this.assertName(name);
    const target = path.join(await this.dir(), `${name}.md`);
    try { return { name, body: await readFile(target, 'utf8') }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw appError({ code: 'NOT_FOUND', entity: name }); throw error; }
  }

  async save(input: { name: string; body: string }): Promise<JournalTemplate> {
    const name = input.name.trim();
    this.assertName(name);
    if (!input.body.trim()) throw appError({ code: 'INVALID_INPUT', message: '模板正文不能为空。' });
    const dir = await this.dir();
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, `${name}.md`);
    await writeFile(target, input.body, 'utf8');
    return { name, body: input.body };
  }

  async delete(name: string): Promise<void> {
    this.assertName(name);
    const target = path.join(await this.dir(), `${name}.md`);
    try { await rm(target, { force: false }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw appError({ code: 'NOT_FOUND', entity: name }); throw error; }
  }

  private assertName(name: string): void {
    if (!NAME_PATTERN.test(name)) throw appError({ code: 'INVALID_INPUT', message: '模板名只能包含中文、字母、数字、空格、连字符，长度 1-40。' });
  }
}
