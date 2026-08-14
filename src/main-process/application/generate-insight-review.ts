import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review, ReviewPreview } from '../../shared/schemas/domain';
import type { InsightReviewPreviewInput } from '../../shared/schemas/ipc';
import { selectInsightMaterials } from '../domain/insight-materials';
import type { ReviewTaskManager } from '../domain/review-task';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { INSIGHT_PROMPTS } from '../prompts/insight-review-prompts';
import { JOURNAL_COACH_PROMPT_VERSION, JOURNAL_COACH_SYSTEM_PROMPT, parseJournalCoachOutput, renderJournalCoach } from '../prompts/journal-coach-v2';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }
type Input = InsightReviewPreviewInput & { model: string };

export class GenerateInsightReview {
  private static readonly PREVIEW_TTL_MS = 30 * 60 * 1000;
  private static readonly MAX_PREVIEWS = 50;
  private previews = new Map<string, { digest: string; input: Input; createdAt: string }>();
  constructor(private journals: MarkdownJournalRepository, private reviews: MarkdownReviewRepository, private provider: ProviderPort, private tasks: ReviewTaskManager, private now = () => new Date().toISOString(), private profiles?: Pick<MarkdownProfileRepository, 'get'>) {}
  private async materials(input: Input) { return selectInsightMaterials(input, await this.journals.list(), await this.reviews.list()); }
  private digest(materials: { id: string; updatedAt?: string; createdAt: string }[]) { return crypto.createHash('sha256').update(materials.map((item) => `${item.id}:${item.updatedAt ?? item.createdAt}`).join('|')).digest('hex'); }

  private prunePreviews() {
    const horizon = new Date(this.now()).getTime() - GenerateInsightReview.PREVIEW_TTL_MS;
    for (const [token, preview] of this.previews) {
      if (new Date(preview.createdAt).getTime() < horizon) this.previews.delete(token);
    }
    while (this.previews.size > GenerateInsightReview.MAX_PREVIEWS) {
      const oldest = this.previews.keys().next();
      if (oldest.done) break;
      this.previews.delete(oldest.value);
    }
  }

  async preview(input: Input): Promise<ReviewPreview> {
    const materials = await this.materials(input);
    const token = crypto.randomUUID();
    this.previews.set(token, { input, digest: this.digest(materials), createdAt: this.now() });
    this.prunePreviews();
    return { token, type: input.type, start: input.start, end: input.end, sources: materials.map((item) => ({ id: item.id, date: 'date' in item ? item.date : item.periodStart, excerpt: item.body.slice(0, 100) })) };
  }

  async execute(input: Input & { previewToken: string }): Promise<Review> {
    this.prunePreviews();
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
      const raw = await this.provider.collect([{ role: 'system', content: input.type === 'coach' ? JOURNAL_COACH_SYSTEM_PROMPT : prompt.system }, { role: 'user', content: JSON.stringify(payload) }], task.controller.signal, input.type === 'coach' ? { jsonObject: true } : undefined);
      let body: string;
      try { body = input.type === 'coach' ? renderJournalCoach(parseJournalCoachOutput(raw), input.start, input.end) : raw.trim(); }
      catch { throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的日志质量报告格式不完整，请重试。' }); }
      if (!body) throw appError({ code: 'INVALID_MODEL_OUTPUT' });
      const review: Review = { schemaVersion: 1, id: `review_${crypto.randomUUID().replace(/-/g, '')}`, type: input.type, periodStart: input.start, periodEnd: input.end, sourceIds: materials.map((item) => item.id), projectId: null, provider: 'openai-compatible', model: input.model, promptVersion: input.type === 'coach' ? JOURNAL_COACH_PROMPT_VERSION : prompt.version, createdAt: this.now(), body };
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
