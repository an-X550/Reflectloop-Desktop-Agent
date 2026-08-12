import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review } from '../../shared/schemas/domain';
import { buildDailyContext } from '../domain/daily-context';
import type { ReviewTaskManager } from '../domain/review-task';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { DAILY_REVIEW_PROMPT_VERSION, DAILY_REVIEW_SYSTEM_PROMPT, DailyReviewOutputSchema, renderDailyReview } from '../prompts/daily-review-v1';
import type { ChatMessage } from '../infrastructure/ai/openai-compatible-provider';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal): Promise<string> }

export class GenerateDailyReview {
  constructor(private readonly journals: MarkdownJournalRepository, private readonly reviews: MarkdownReviewRepository, private readonly provider: ProviderPort, private readonly tasks: ReviewTaskManager, private readonly now = () => new Date().toISOString()) {}
  async execute(input: { journalId: string; model: string; regenerate?: boolean }): Promise<Review> {
    const existing = (await this.reviews.list()).filter((review) => review.type === 'daily' && review.sourceIds.includes(input.journalId)).at(-1);
    if (existing && !input.regenerate) return existing;
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'building_context');
      const journal = await this.journals.get(input.journalId);
      const context = buildDailyContext(journal, await this.journals.list(), await this.reviews.list());
      this.tasks.transition(task.taskId, 'generating');
      const raw = await this.provider.collect([{ role: 'system', content: DAILY_REVIEW_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(context) }], task.controller.signal);
      this.tasks.transition(task.taskId, 'validating');
      let output;
      try { output = DailyReviewOutputSchema.parse(JSON.parse(raw)); } catch { throw appError({ code: 'INVALID_MODEL_OUTPUT' }); }
      const createdAt = this.now();
      const review: Review = { schemaVersion: 1, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: 'daily', periodStart: journal.date, periodEnd: journal.date, sourceIds: [journal.id], projectId: null, provider: 'openai-compatible', model: input.model, promptVersion: DAILY_REVIEW_PROMPT_VERSION, createdAt, body: renderDailyReview(output) };
      this.tasks.transition(task.taskId, 'saving');
      await this.reviews.save(review);
      this.tasks.transition(task.taskId, 'completed');
      return review;
    } catch (error) { if (task.controller.signal.aborted) this.tasks.transition(task.taskId, 'cancelled'); else this.tasks.transition(task.taskId, 'failed'); throw error; }
  }
}
