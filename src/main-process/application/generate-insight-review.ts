import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { Review, ReviewPreview } from '../../shared/schemas/domain';
import type { InsightReviewPreviewInput } from '../../shared/schemas/ipc';
import { selectInsightMaterials } from '../domain/insight-materials';
import type { ReviewTaskManager } from '../domain/review-task';
import type { ProviderPort } from '../infrastructure/ai/provider-port';
import type { MarkdownJournalRepository } from '../infrastructure/markdown/journal-repository';
import type { MarkdownProfileRepository } from '../infrastructure/markdown/profile-repository';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import { INSIGHT_PROMPTS } from '../prompts/insight-review-prompts';
import { JOURNAL_COACH_PROMPT_VERSION, JOURNAL_COACH_SYSTEM_PROMPT, parseJournalCoachOutput, renderJournalCoach } from '../prompts/journal-coach-v2';
import { PreviewTokenStore } from './preview-token-store';

type Input = InsightReviewPreviewInput & { model: string };

export class GenerateInsightReview {
  private readonly previews: PreviewTokenStore<Input>;
  constructor(private journals: MarkdownJournalRepository, private reviews: MarkdownReviewRepository, private provider: ProviderPort, private tasks: ReviewTaskManager, private now = () => new Date().toISOString(), private profiles?: Pick<MarkdownProfileRepository, 'get'>) { this.previews = new PreviewTokenStore(this.now); }
  private async materials(input: Input) { return selectInsightMaterials(input, await this.journals.list(), await this.reviews.list()); }

  async preview(input: Input): Promise<ReviewPreview> {
    const materials = await this.materials(input);
    const { token } = this.previews.issue(input, materials);
    return { token, type: input.type, start: input.start, end: input.end, sources: materials.map((item) => ({ id: item.id, date: 'date' in item ? item.date : item.periodStart, excerpt: item.body.slice(0, 100) })) };
  }

  async execute(input: Input & { previewToken: string }, externalSignal?: AbortSignal): Promise<Review> {
    const preview = this.previews.peek(input.previewToken);
    if (!preview || preview.input.type !== input.type) throw appError({ code: 'INVALID_INPUT', message: '请先预览并确认材料。' });
    const materials = await this.materials(input);
    if (PreviewTokenStore.digest(materials) !== preview.digest) throw appError({ code: 'INVALID_INPUT', message: '材料已变化，请重新预览。' });
    this.previews.consume(input.previewToken);
    const task = this.tasks.start();
    const abortExternal = () => task.controller.abort();
    if (externalSignal?.aborted) task.controller.abort();
    else externalSignal?.addEventListener('abort', abortExternal, { once: true });
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
      this.tasks.transition(task.taskId, task.controller.signal.aborted || externalSignal?.aborted ? 'cancelled' : 'failed');
      throw error;
    } finally { externalSignal?.removeEventListener('abort', abortExternal); }
  }
}
