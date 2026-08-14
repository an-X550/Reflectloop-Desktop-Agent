import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Journal, PeriodicGenerationResult, Review, ReviewPreview } from '../../shared/schemas/domain';
import { selectMaterials, type MaterialSelection } from '../domain/material-selector';
import type { ReviewTaskManager } from '../domain/review-task';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { PERIODIC_REVIEW_PROMPT_VERSION } from '../prompts/periodic-review-v1';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import { runPeriodicFeedback } from '../skill-runtime/periodic-runtime';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }
type Input = MaterialSelection & { model: string };

export class GeneratePeriodicReview {
  private static readonly PREVIEW_TTL_MS = 30 * 60 * 1000;
  private static readonly MAX_PREVIEWS = 50;
  private previews = new Map<string, { digest: string; input: Input; createdAt: string }>();
  constructor(private journals: MarkdownJournalRepository, private reviews: MarkdownReviewRepository, private provider: ProviderPort, private tasks: ReviewTaskManager, private now = () => new Date().toISOString(), private profiles?: Pick<MarkdownProfileRepository, 'get'>) {}
  private async materials(input: Input) { return selectMaterials(input, await this.journals.list(), await this.reviews.list()); }
  private digest(materials: { id: string; updatedAt?: string; createdAt: string }[]) { return crypto.createHash('sha256').update(materials.map((x) => `${x.id}:${x.updatedAt ?? x.createdAt}`).join('|')).digest('hex'); }
  private prunePreviews() {
    const horizon = new Date(this.now()).getTime() - GeneratePeriodicReview.PREVIEW_TTL_MS;
    for (const [token, preview] of this.previews) {
      if (new Date(preview.createdAt).getTime() < horizon) this.previews.delete(token);
    }
    while (this.previews.size > GeneratePeriodicReview.MAX_PREVIEWS) {
      const oldest = this.previews.keys().next();
      if (oldest.done) break;
      this.previews.delete(oldest.value);
    }
  }
  async preview(input: Input): Promise<ReviewPreview> {
    const materials = await this.materials(input);
    if (!materials.length) throw appError({ code: 'INVALID_INPUT', message: '所选范围内没有可复盘材料。' });
    const token = crypto.randomUUID();
    this.previews.set(token, { input, digest: this.digest(materials), createdAt: this.now() });
    this.prunePreviews();
    return { token, type: input.type, start: input.start, end: input.end, sources: materials.map((material) => { const item: Journal | Review = material; return { id: item.id, date: 'date' in item ? item.date : item.periodStart, excerpt: item.body.slice(0, 100) }; }) };
  }
  async execute(input: Input & { previewToken: string }): Promise<PeriodicGenerationResult> {
    this.prunePreviews();
    const preview = this.previews.get(input.previewToken);
    if (!preview) throw appError({ code: 'INVALID_INPUT', message: '请先预览并确认材料。' });
    const materials = await this.materials(input);
    if (this.digest(materials) !== preview.digest) throw appError({ code: 'INVALID_INPUT', message: '材料已变化，请重新预览。' });
    this.previews.delete(input.previewToken);
    const task = this.tasks.start();
    try {
      this.tasks.transition(task.taskId, 'generating');
      const profile = await this.profiles?.get();
      const journalMaterials = materials.filter((m): m is Journal => !('type' in m));
      const reviewMaterials = materials.filter((m): m is Review => 'type' in m);
      const runtime = await runPeriodicFeedback({
        type: input.type as 'weekly' | 'monthly' | 'project', start: input.start, end: input.end,
        journals: journalMaterials, reviews: reviewMaterials, provider: this.provider, signal: task.controller.signal,
        ...(profile?.enabledForAi ? { profile: profile.body } : {}),
      });
      if (runtime.kind === 'clarification') {
        this.tasks.transition(task.taskId, 'completed');
        return { kind: 'clarification', question: runtime.question };
      }
      this.tasks.transition(task.taskId, 'validating');
      const createdAt = this.now();
      const review: Review = { schemaVersion: 1, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: input.type, periodStart: input.start, periodEnd: input.end, sourceIds: materials.map((x) => x.id), projectId: input.projectId ?? null, provider: 'openai-compatible', model: input.model, promptVersion: PERIODIC_REVIEW_PROMPT_VERSION, createdAt, body: runtime.body };
      this.tasks.transition(task.taskId, 'saving'); await this.reviews.save(review); this.tasks.transition(task.taskId, 'completed');
      return { kind: 'review', review };
    } catch (error) { this.tasks.transition(task.taskId, task.controller.signal.aborted ? 'cancelled' : 'failed'); throw error; }
  }
}
