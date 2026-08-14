import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import { isDailyReviewFresh, toSourceVersions } from '../../shared/domain/daily-freshness';
import type { DailyGenerationResult, Review } from '../../shared/schemas/domain';
import type { ReviewTaskManager } from '../domain/review-task';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { DAILY_REVIEW_PROMPT_VERSION } from '../prompts/daily-review-v1';
import type { ProviderPort } from '../infrastructure/ai/provider-port';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import { runDailyFeedback } from '../skill-runtime/daily-runtime';
import type { DailyAuditRecorder } from '../skill-runtime/daily-audit-recorder';

export type DailyReviewResult = DailyGenerationResult;

export class GenerateDailyReview {
  constructor(private readonly journals: MarkdownJournalRepository, private readonly reviews: MarkdownReviewRepository, private readonly provider: ProviderPort, private readonly tasks: ReviewTaskManager, private readonly now = () => new Date().toISOString(), private readonly profiles?: Pick<MarkdownProfileRepository, 'get'>, private readonly audit?: Pick<DailyAuditRecorder, 'record'>) {}
  async execute(input: { date: string; model: string; regenerate?: boolean }): Promise<DailyReviewResult> {
    const journals = (await this.journals.list()).filter((journal) => journal.date === input.date);
    if (!journals.length) throw appError({ code: 'NOT_FOUND', entity: input.date });
    const sourceVersions = toSourceVersions(journals);
    const existing = (await this.reviews.list()).filter((review) => review.type === 'daily' && review.periodStart === input.date).at(-1);
    if (isDailyReviewFresh(existing, input.date, sourceVersions) && !input.regenerate) return { kind: 'review', review: existing };
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'building_context');
      this.tasks.transition(task.taskId, 'generating');
      const profile = await this.profiles?.get();
      const runtime = await runDailyFeedback({ journals, reviews: await this.reviews.list(), provider: this.provider, signal: task.controller.signal, ...(profile?.enabledForAi ? { profile: profile.body } : {}) });
      if (runtime.kind === 'clarification') {
        await this.audit?.record({ date: input.date, sourceIds: journals.map((journal) => journal.id), grade: runtime.grade, outcome: 'clarification' });
        this.tasks.transition(task.taskId, 'completed');
        return { kind: 'clarification', question: runtime.question };
      }
      this.tasks.transition(task.taskId, 'validating');
      const createdAt = this.now();
      const review: Review = { schemaVersion: 2, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: 'daily', periodStart: input.date, periodEnd: input.date, sourceIds: journals.map((journal) => journal.id), sourceVersions, projectId: null, provider: 'openai-compatible', model: input.model, promptVersion: DAILY_REVIEW_PROMPT_VERSION, createdAt, body: runtime.body };
      this.tasks.transition(task.taskId, 'saving');
      await this.reviews.save(review);
      await this.audit?.record({ date: input.date, sourceIds: review.sourceIds, grade: runtime.grade, outcome: 'review', ...(runtime.output.priorAction ? { priorActionStatus: runtime.output.priorAction.status } : {}) });
      this.tasks.transition(task.taskId, 'completed');
      return { kind: 'review', review };
    } catch (error) { if (task.controller.signal.aborted) this.tasks.transition(task.taskId, 'cancelled'); else this.tasks.transition(task.taskId, 'failed'); throw error; }
  }
}
