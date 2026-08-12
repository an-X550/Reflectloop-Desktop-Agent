import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GenerateDailyReview } from '../../src/main-process/application/generate-daily-review';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';
import { MarkdownReviewRepository } from '../../src/main-process/infrastructure/markdown/review-repository';
import { ReviewTaskManager } from '../../src/main-process/domain/review-task';

describe('GenerateDailyReview', () => {
  it('validates model JSON before atomically saving an official review', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    const journal = await journals.save({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了关键模块。' });
    const provider = { collect: async () => JSON.stringify({ priorAction: null, insight: { quote: '完成了关键模块', text: '聚焦带来了进展' }, action: { step: '列出明天第一步', prediction: '明早能直接开始' }, trackingLine: '明天检查是否直接开始' }) };
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => '2026-08-13T10:00:00.000Z');
    const result = await useCase.execute({ journalId: journal.id, model: 'fake' });
    expect(result.type).toBe('daily');
    expect(await reviews.get(result.id)).toEqual(result);
  });

  it('does not save invalid model output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.save({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '日志' });
    const useCase = new GenerateDailyReview(journals, reviews, { collect: async () => '{bad json' }, new ReviewTaskManager());
    await expect(useCase.execute({ journalId: 'journal_a1', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    expect(await reviews.list()).toEqual([]);
  });
});
