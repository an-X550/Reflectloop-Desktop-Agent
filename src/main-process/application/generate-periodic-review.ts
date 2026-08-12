import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review } from '../../shared/schemas/domain';
import { selectMaterials, type MaterialSelection } from '../domain/material-selector';
import type { ReviewTaskManager } from '../domain/review-task';
import type { ChatMessage } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { PERIODIC_PROMPTS, periodicSystemPrompt } from '../prompts/periodic-review-prompts';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal): Promise<string> }
type Input = MaterialSelection & { model: string };

export class GeneratePeriodicReview {
  private previews = new Map<string, { digest: string; input: Input }>();
  constructor(private journals: MarkdownJournalRepository, private reviews: MarkdownReviewRepository, private provider: ProviderPort, private tasks: ReviewTaskManager, private now = () => new Date().toISOString()) {}
  private async materials(input: Input) { return selectMaterials(input, await this.journals.list(), await this.reviews.list()); }
  private digest(materials: { id: string; updatedAt?: string; createdAt: string }[]) { return crypto.createHash('sha256').update(materials.map((x) => `${x.id}:${x.updatedAt ?? x.createdAt}`).join('|')).digest('hex'); }
  async preview(input: Input) {
    const materials = await this.materials(input);
    if (!materials.length) throw appError({ code: 'INVALID_INPUT', message: '所选范围内没有可复盘材料。' });
    const token = crypto.randomUUID();
    this.previews.set(token, { input, digest: this.digest(materials) });
    return { token, type: input.type, start: input.start, end: input.end, sources: materials.map((x) => ({ id: x.id, date: 'date' in x ? x.date : x.periodStart, excerpt: x.body.slice(0, 100) })) };
  }
  async execute(input: Input & { previewToken: string }): Promise<Review> {
    const preview = this.previews.get(input.previewToken);
    if (!preview) throw appError({ code: 'INVALID_INPUT', message: '请先预览并确认材料。' });
    const materials = await this.materials(input);
    if (this.digest(materials) !== preview.digest) throw appError({ code: 'INVALID_INPUT', message: '材料已变化，请重新预览。' });
    this.previews.delete(input.previewToken);
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'generating');
      const body = (await this.provider.collect([{ role: 'system', content: periodicSystemPrompt(input.type as 'weekly' | 'monthly' | 'project') }, { role: 'user', content: JSON.stringify(materials.map((x) => ({ id: x.id, body: x.body }))) }], task.controller.signal)).trim();
      if (!body) throw appError({ code: 'INVALID_MODEL_OUTPUT' });
      const createdAt = this.now();
      const review: Review = { schemaVersion: 1, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: input.type, periodStart: input.start, periodEnd: input.end, sourceIds: materials.map((x) => x.id), projectId: input.projectId ?? null, provider: 'openai-compatible', model: input.model, promptVersion: PERIODIC_PROMPTS[input.type as 'weekly' | 'monthly' | 'project'].version, createdAt, body };
      this.tasks.transition(task.taskId, 'saving'); await this.reviews.save(review); this.tasks.transition(task.taskId, 'completed'); return review;
    } catch (error) { this.tasks.transition(task.taskId, task.controller.signal.aborted ? 'cancelled' : 'failed'); throw error; }
  }
}
