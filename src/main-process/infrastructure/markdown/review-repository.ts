import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { ReviewSchema, type Review } from '../../../shared/schemas/domain';
import { appError } from '../../../shared/errors/app-error';
import { atomicWriteUtf8 } from './atomic-write';
import { resolveInsideRoot } from './path-policy';

function serialize(review: Review) { const { body, ...data } = review; return matter.stringify(body, data); }
function parse(value: string): Review { const { data, content } = matter(value); return ReviewSchema.parse({ ...data, body: content.trim() }); }

export class MarkdownReviewRepository {
  constructor(private readonly root: string) {}
  async save(input: Review) {
    const review = ReviewSchema.parse(input);
    const target = await resolveInsideRoot(this.root, 'reviews', review.type, review.periodStart.slice(0, 4), `${review.periodStart}-${review.id}.md`);
    await atomicWriteUtf8(target, serialize(review), (value) => parse(value));
    return review;
  }
  async list(): Promise<Review[]> {
    const output: Review[] = [];
    const root = await resolveInsideRoot(this.root, 'reviews');
    async function walk(folder: string): Promise<void> {
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const target = await resolveInsideRoot(folder, entry.name);
        if (entry.isDirectory()) await walk(target); else if (entry.name.endsWith('.md')) output.push(parse(await readFile(target, 'utf8')));
      }
    }
    try { await walk(root); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return output.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async get(id: string): Promise<Review> {
    const result = (await this.list()).find((review) => review.id === id);
    if (!result) throw appError({ code: 'NOT_FOUND', entity: id });
    return result;
  }
}
