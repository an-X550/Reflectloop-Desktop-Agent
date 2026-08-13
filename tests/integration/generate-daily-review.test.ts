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
    const journal = await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了关键模块。' });
    const provider = { collect: async () => JSON.stringify({ priorAction: null, insight: { quote: '完成了关键模块', text: '聚焦带来了进展' }, action: { step: '列出明天第一步', prediction: '明早能直接开始' }, trackingLine: '明天检查是否直接开始' }) };
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => '2026-08-13T10:00:00.000Z');
    const result = await useCase.execute({ date: journal.date, model: 'fake' });
    expect(result.type).toBe('daily');
    expect(await reviews.get(result.id)).toEqual(result);
  });

  it('does not save invalid model output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '日志' });
    const useCase = new GenerateDailyReview(journals, reviews, { collect: async () => '{bad json' }, new ReviewTaskManager());
    await expect(useCase.execute({ date: '2026-08-13', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    expect(await reviews.list()).toEqual([]);
  });

  it('covers every same-day journal and invalidates stale feedback', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    const base = { schemaVersion: 1 as const, date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [] };
    await journals.create({ ...base, id: 'journal_a1', body: '第一条' });
    await journals.create({ ...base, id: 'journal_b2', createdAt: '2026-08-13T09:00:00.000Z', updatedAt: '2026-08-13T09:00:00.000Z', body: '第二条' });
    let calls = 0;
    const provider = { collect: async () => { calls += 1; return JSON.stringify({ priorAction: null, insight: { quote: '第一条', text: '有进展' }, action: { step: '继续', prediction: '可完成' }, trackingLine: '检查' }); } };
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => `2026-08-13T1${calls}:00:00.000Z`);
    const first = await useCase.execute({ date: '2026-08-13', model: 'fake' });
    expect(first.sourceIds).toEqual(['journal_a1', 'journal_b2']);
    await expect(useCase.execute({ date: '2026-08-13', model: 'fake' })).resolves.toEqual(first);
    const current = await journals.get('journal_a1');
    await journals.update({ ...current, body: '第一条已改', updatedAt: '2026-08-13T10:30:00.000Z' }, current.updatedAt);
    const refreshed = await useCase.execute({ date: '2026-08-13', model: 'fake' });
    expect(refreshed.id).not.toBe(first.id);
    expect(calls).toBe(2);
  });
});
