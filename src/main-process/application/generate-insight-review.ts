import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review } from '../../shared/schemas/domain';
import type { InsightReviewPreviewInput } from '../../shared/schemas/ipc';
import { selectInsightMaterials } from '../domain/insight-materials';
import type { ReviewTaskManager } from '../domain/review-task';
import type { ChatMessage } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { INSIGHT_PROMPTS } from '../prompts/insight-review-prompts';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal): Promise<string> }
type Input = InsightReviewPreviewInput & { model: string };

export class GenerateInsightReview {
  private previews = new Map<string, { digest: string; input: Input }>();
  constructor(private journals: MarkdownJournalRepository, private reviews: MarkdownReviewRepository, private provider: ProviderPort, private tasks: ReviewTaskManager, private now = () => new Date().toISOString(), private profiles?: Pick<MarkdownProfileRepository, 'get'>) {}
  private async materials(input: Input) { return selectInsightMaterials(input, await this.journals.list(), await this.reviews.list()); }
  private digest(materials: { id: string; updatedAt?: string; createdAt: string }[]) { return crypto.createHash('sha256').update(materials.map((item) => `${item.id}:${item.updatedAt ?? item.createdAt}`).join('|')).digest('hex'); }

  async preview(input: Input) {
    const materials = await this.materials(input);
    const token = crypto.randomUUID();
    this.previews.set(token, { input, digest: this.digest(materials) });
    return { token, type: input.type, start: input.start, end: input.end, sources: materials.map((item) => ({ id: item.id, date: 'date' in item ? item.date : item.periodStart, excerpt: item.body.slice(0, 100) })) };
  }

  async execute(input: Input & { previewToken: string }): Promise<Review> {
    const preview = this.previews.get(input.previewToken);
    if (!preview || preview.input.type !== input.type) throw appError({ code: 'INVALID_INPUT', message: '请先预览并确认材料。' });
    const materials = await this.materials(input);
    if (this.digest(materials) !== preview.digest) throw appError({ code: 'INVALID_INPUT', message: '材料已变化，请重新预览。' });
    this.previews.delete(input.previewToken);
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'generating');
      const profile = await this.profiles?.get();
      const prompt = INSIGHT_PROMPTS[input.type];
      const payload = { materials: materials.map((item) => ({ id: item.id, date: 'date' in item ? item.date : item.periodStart, body: item.body })), ...('topic' in input && input.topic ? { topic: input.topic } : {}), ...(profile?.enabledForAi ? { profile: profile.body } : {}) };
      const body = (await this.provider.collect([{ role: 'system', content: prompt.system }, { role: 'user', content: JSON.stringify(payload) }], task.controller.signal)).trim();
      if (!body) throw appError({ code: 'INVALID_MODEL_OUTPUT' });
      const review: Review = { schemaVersion: 1, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: input.type, periodStart: input.start, periodEnd: input.end, sourceIds: materials.map((item) => item.id), projectId: null, provider: 'openai-compatible', model: input.model, promptVersion: prompt.version, createdAt: this.now(), body };
      this.tasks.transition(task.taskId, 'saving');
      await this.reviews.save(review);
      this.tasks.transition(task.taskId, 'completed');
      return review;
    } catch (error) {
      this.tasks.transition(task.taskId, task.controller.signal.aborted ? 'cancelled' : 'failed');
      throw error;
    }
  }
}
