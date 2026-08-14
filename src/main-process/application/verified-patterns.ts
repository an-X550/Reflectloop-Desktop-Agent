import crypto from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { VerifiedPattern, VerifiedPatternCandidate, VerifiedPatternSnapshot } from '../../shared/schemas/domain';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import type { MarkdownReviewRepository } from '../infrastructure/markdown/review-repository';
import type { VerifiedPatternRepository } from '../infrastructure/patterns/verified-pattern-repository';
import { MAX_PATTERN_CANDIDATES, parseVerifiedPatternsOutput, verifiedPatternsSystemPrompt } from '../prompts/verified-patterns-v1';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }

/**
 * 验证模式：模型只能提出候选，只有用户明确确认后才写入快照。
 */
export class VerifiedPatternService {
  constructor(
    private readonly reviews: Pick<MarkdownReviewRepository, 'get'>,
    private readonly patterns: VerifiedPatternRepository,
    private readonly provider: ProviderPort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async list(): Promise<VerifiedPatternSnapshot> {
    return this.patterns.list();
  }

  async propose(input: { reviewId: string; model: string }): Promise<VerifiedPatternCandidate[]> {
    const review = await this.reviews.get(input.reviewId);
    const raw = await this.provider.collect([
      { role: 'system', content: verifiedPatternsSystemPrompt() },
      { role: 'user', content: JSON.stringify({ review: { id: review.id, type: review.type, periodStart: review.periodStart, periodEnd: review.periodEnd, body: review.body } }) },
    ], undefined, { jsonObject: true });
    let output;
    try {
      output = parseVerifiedPatternsOutput(raw);
    } catch {
      throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的验证模式候选格式无效。' });
    }
    return output.candidates.slice(0, MAX_PATTERN_CANDIDATES)
      .map((candidate) => ({ ...candidate, sourceReviewIds: [review.id] }));
  }

  async confirm(input: VerifiedPatternCandidate): Promise<VerifiedPattern> {
    const pattern: VerifiedPattern = {
      schemaVersion: 1,
      id: `pattern_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      statement: input.statement,
      evidenceSummary: input.evidenceSummary,
      sourceReviewIds: input.sourceReviewIds,
      createdAt: this.now(),
    };
    await this.patterns.add(pattern);
    return pattern;
  }
}
