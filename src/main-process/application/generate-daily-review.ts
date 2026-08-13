import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review } from '../../shared/schemas/domain';
import { buildDailyContext } from '../domain/daily-context';
import type { ReviewTaskManager } from '../domain/review-task';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { DAILY_REVIEW_PROMPT_VERSION, DAILY_REVIEW_SYSTEM_PROMPT, parseDailyReviewOutput, renderDailyReview } from '../prompts/daily-review-v1';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }

export class GenerateDailyReview {
  constructor(private readonly journals: MarkdownJournalRepository, private readonly reviews: MarkdownReviewRepository, private readonly provider: ProviderPort, private readonly tasks: ReviewTaskManager, private readonly now = () => new Date().toISOString(), private readonly profiles?: Pick<MarkdownProfileRepository, 'get'>) {}
  async execute(input: { date: string; model: string; regenerate?: boolean }): Promise<Review> {
    const journals = (await this.journals.list()).filter((journal) => journal.date === input.date);
    if (!journals.length) throw appError({ code: 'NOT_FOUND', entity: input.date });
    const sourceVersions = journals.map(({ id, updatedAt }) => ({ id, updatedAt })).sort((a, b) => a.id.localeCompare(b.id));
    const existing = (await this.reviews.list()).filter((review) => review.type === 'daily' && review.periodStart === input.date).at(-1);
    if (existing?.schemaVersion === 2 && JSON.stringify(existing.sourceVersions.slice().sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify(sourceVersions) && !input.regenerate) return existing;
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'building_context');
      const context = buildDailyContext(journals, await this.reviews.list());
      this.tasks.transition(task.taskId, 'generating');
      const profile = await this.profiles?.get();
      const raw = await this.provider.collect([{ role: 'system', content: DAILY_REVIEW_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ context, ...(profile?.enabledForAi ? { profile: profile.body } : {}) }) }], task.controller.signal, { jsonObject: true });
      this.tasks.transition(task.taskId, 'validating');
      let output;
      try { output = parseDailyReviewOutput(raw); } catch { throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的反馈格式不完整，请重试；若持续失败，请确认模型支持 JSON 输出。' }); }
      const createdAt = this.now();
      const review: Review = { schemaVersion: 2, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: 'daily', periodStart: input.date, periodEnd: input.date, sourceIds: journals.map((journal) => journal.id), sourceVersions, projectId: null, provider: 'openai-compatible', model: input.model, promptVersion: DAILY_REVIEW_PROMPT_VERSION, createdAt, body: renderDailyReview(output, input.date) };
      this.tasks.transition(task.taskId, 'saving');
      await this.reviews.save(review);
      this.tasks.transition(task.taskId, 'completed');
      return review;
    } catch (error) { if (task.controller.signal.aborted) this.tasks.transition(task.taskId, 'cancelled'); else this.tasks.transition(task.taskId, 'failed'); throw error; }
  }
}
