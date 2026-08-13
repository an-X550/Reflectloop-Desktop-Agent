import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GenerateDailyReview } from '../../src/main-process/application/generate-daily-review';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';
import { MarkdownReviewRepository } from '../../src/main-process/infrastructure/markdown/review-repository';
import { ReviewTaskManager } from '../../src/main-process/domain/review-task';
import { renderDailyReview } from '../../src/main-process/prompts/daily-review-v1';

describe('GenerateDailyReview', () => {
  it('renders prior action closure when the model finds one', () => {
    const body = renderDailyReview({ priorAction: { status: 'done', evidence: '日志写明已连续执行。' }, insight: { quote: '完成了', text: '执行有效。' }, action: { step: '继续五分钟', prediction: '明早能直接开始' }, trackingLine: '明天检查。' });
    expect(body).toContain('上一行动');
    expect(body).toContain('已完成');
    expect(body).toContain('日志写明已连续执行。');
  });

  it('injects personal background only when the user enables it', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '日志' });
    const payloads: string[] = [];
    const provider = { collect: async (messages: { content: string }[]) => { payloads.push(messages.at(-1)?.content ?? ''); return JSON.stringify({ priorAction: null, insight: { quote: '日志', text: '洞见' }, action: { step: '先做五分钟', prediction: '可以开始' }, trackingLine: '检查' }); } };
    let enabled = true;
    const profiles = { get: async () => ({ body: '我是转型中的前端开发者', enabledForAi: enabled }) } as never;
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => new Date().toISOString(), profiles);
    await useCase.execute({ date: '2026-08-13', model: 'fake', regenerate: true });
    enabled = false;
    await useCase.execute({ date: '2026-08-13', model: 'fake', regenerate: true });
    expect(payloads[0]).toContain('我是转型中的前端开发者');
    expect(payloads[1]).not.toContain('我是转型中的前端开发者');
  });
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

  it('accepts valid JSON wrapped in a markdown fence and requests structured output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了关键模块。' });
    let options: { jsonObject?: boolean } | undefined;
    let systemPrompt = '';
    const output = { priorAction: null, insight: { quote: '完成了关键模块', text: '聚焦带来了进展' }, action: { step: '列出明天第一步', prediction: '明早能直接开始' }, trackingLine: '明天检查是否直接开始' };
    const provider = { collect: async (messages: { content: string }[], _signal: unknown, nextOptions?: { jsonObject?: boolean }) => { systemPrompt = messages[0].content; options = nextOptions; return `\`\`\`json\n${JSON.stringify(output)}\n\`\`\``; } };
    const result = await new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager()).execute({ date: '2026-08-13', model: 'deepseek-chat' });
    expect(result.body).toContain('完成了关键模块');
    expect(options).toEqual({ jsonObject: true });
    expect(systemPrompt).toContain('"priorAction"');
    expect(systemPrompt).toContain('"done" | "not_done" | "insufficient"');
  });

  it('does not save invalid model output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '日志' });
    const useCase = new GenerateDailyReview(journals, reviews, { collect: async () => '{bad json' }, new ReviewTaskManager());
    await expect(useCase.execute({ date: '2026-08-13', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT', message: expect.stringContaining('AI 返回') });
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
