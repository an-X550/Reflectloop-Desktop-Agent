import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GenerateDailyReview } from '../../src/main-process/application/generate-daily-review';
import { MarkdownJournalRepository } from '../../src/main-process/infrastructure/markdown/journal-repository';
import { MarkdownReviewRepository } from '../../src/main-process/infrastructure/markdown/review-repository';
import { ReviewTaskManager } from '../../src/main-process/domain/review-task';
import { DAILY_REVIEW_PROMPT_VERSION, DAILY_REVIEW_SYSTEM_PROMPT, renderDailyReview } from '../../src/main-process/prompts/daily-review-v1';

describe('GenerateDailyReview', () => {
  it('returns a clarification after at most one grade-review call and never saves a review for D-grade input', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '不知道。' });
    const collect = vi.fn();
    const audit = { record: vi.fn() };
    const result = await new GenerateDailyReview(journals, reviews, { collect }, new ReviewTaskManager(), undefined, undefined, audit).execute({ date: '2026-08-13', model: 'fake' });
    expect(result).toMatchObject({ kind: 'clarification', question: expect.any(String) });
    expect(collect).toHaveBeenCalledTimes(1);
    expect(await reviews.list()).toEqual([]);
    expect(audit.record).toHaveBeenCalledWith({ date: '2026-08-13', sourceIds: ['journal_a1'], grade: 'D', outcome: 'clarification' });
  });
  it('renders prior action closure when the model finds one', () => {
    const body = renderDailyReview({ priorAction: { action: '先写第一行', prediction: '晚上会更早开始', status: 'done', evidence: '日志写明已连续执行。', insightStatus: '获得支持' }, insight: { quote: '完成了', text: '执行有效。' }, patternConnection: null, action: { step: '继续五分钟', prediction: '明早能直接开始' }, newInsight: '先启动比等待状态更有效' }, '2026-08-13');
    expect(body).toContain('📋 8月13日 日志反馈');
    expect(body).toContain('⏮️ 昨天你答应自己');
    expect(body).toContain('✅ 做到了');
    expect(body).toContain('日志写明已连续执行。');
    expect(body).toContain('🔍 你没注意到的');
    expect(body).toContain('「完成了」');
    expect(body).toContain('⚡ 明天试试\n行动：继续五分钟\n预测：明早能直接开始');
    expect(body).toContain('💊 新认知：先启动比等待状态更有效 | 行动：继续五分钟 | 验证：待明天');
    expect(body).not.toContain('##');
  });

  it('injects personal background only when the user enables it', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了模块，感觉轻松。我发现先列第一步有效，明天继续。' });
    const payloads: string[] = [];
    const provider = { collect: async (messages: { content: string }[]) => { payloads.push(messages.at(-1)?.content ?? ''); return JSON.stringify({ priorAction: null, insight: { quote: '日志', text: '洞见' }, patternConnection: null, action: { step: '先做五分钟', prediction: '可以开始' }, newInsight: '启动比等待更有效' }); } };
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
    const provider = { collect: async () => JSON.stringify({ priorAction: null, insight: { quote: '完成了关键模块', text: '聚焦带来了进展' }, patternConnection: null, action: { step: '列出明天第一步', prediction: '明早能直接开始' }, newInsight: '聚焦带来进展' }) };
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => '2026-08-13T10:00:00.000Z');
    const result = await useCase.execute({ date: journal.date, model: 'fake' });
    expect(result.kind).toBe('review');
    if (result.kind !== 'review') throw new Error('expected a review');
    expect(result.review.type).toBe('daily');
    expect(await reviews.get(result.review.id)).toEqual(result.review);
  });

  it('accepts valid JSON wrapped in a markdown fence and requests structured output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了关键模块。' });
    let options: { jsonObject?: boolean } | undefined;
    let systemPrompt = '';
    const output = { priorAction: null, insight: { quote: '完成了关键模块', text: '聚焦带来了进展' }, patternConnection: null, action: { step: '列出明天第一步', prediction: '明早能直接开始' }, newInsight: '聚焦带来进展' };
    const provider = { collect: async (messages: { content: string }[], _signal: unknown, nextOptions?: { jsonObject?: boolean }) => { systemPrompt = messages[0].content; options = nextOptions; return `\`\`\`json\n${JSON.stringify(output)}\n\`\`\``; } };
    const result = await new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager()).execute({ date: '2026-08-13', model: 'deepseek-chat' });
    expect(result.kind).toBe('review');
    if (result.kind !== 'review') throw new Error('expected a review');
    expect(result.review.body).toContain('完成了关键模块');
    expect(options).toEqual({ jsonObject: true });
    expect(systemPrompt).toContain('"priorAction"');
    expect(systemPrompt).toContain('"done" | "not_done" | "insufficient"');
    expect(systemPrompt).toContain('D0-D6');
    expect(systemPrompt).toContain('只能有一个动作');
  });

  it('does not save invalid model output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    await journals.create({ schemaVersion: 1, id: 'journal_a1', date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [], body: '完成了关键模块，但很累。' });
    const useCase = new GenerateDailyReview(journals, reviews, { collect: async () => '{bad json' }, new ReviewTaskManager());
    await expect(useCase.execute({ date: '2026-08-13', model: 'fake' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT', message: expect.stringContaining('AI 返回') });
    expect(await reviews.list()).toEqual([]);
  });

  it('covers every same-day journal and invalidates stale feedback', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-review-'));
    const journals = new MarkdownJournalRepository(root);
    const reviews = new MarkdownReviewRepository(root);
    const base = { schemaVersion: 1 as const, date: '2026-08-13', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T08:00:00.000Z', projectIds: [] };
    await journals.create({ ...base, id: 'journal_a1', body: '完成了第一条任务，但很累。' });
    await journals.create({ ...base, id: 'journal_b2', createdAt: '2026-08-13T09:00:00.000Z', updatedAt: '2026-08-13T09:00:00.000Z', body: '写了第二条任务，但很累。' });
    let calls = 0;
    const provider = { collect: async () => { calls += 1; return JSON.stringify({ priorAction: null, insight: { quote: '第一条', text: '有进展' }, patternConnection: null, action: { step: '继续', prediction: '可完成' }, newInsight: '记录有助于验证' }); } };
    const useCase = new GenerateDailyReview(journals, reviews, provider, new ReviewTaskManager(), () => `2026-08-13T1${calls}:00:00.000Z`);
    const firstResult = await useCase.execute({ date: '2026-08-13', model: 'fake' });
    expect(firstResult.kind).toBe('review');
    if (firstResult.kind !== 'review') throw new Error('expected a review');
    const first = firstResult.review;
    expect(first.sourceIds).toEqual(['journal_a1', 'journal_b2']);
    await expect(useCase.execute({ date: '2026-08-13', model: 'fake' })).resolves.toEqual({ kind: 'review', review: first });
    const current = await journals.get('journal_a1');
    await journals.update({ ...current, body: '完成了第一条任务并补上验证，但很累。', updatedAt: '2026-08-13T10:30:00.000Z' }, current.updatedAt);
    const refreshedResult = await useCase.execute({ date: '2026-08-13', model: 'fake' });
    expect(refreshedResult.kind).toBe('review');
    if (refreshedResult.kind !== 'review') throw new Error('expected a review');
    expect(refreshedResult.review.id).not.toBe(first.id);
    expect(calls).toBe(2);
  });

  it('states the regular 260-char cap with the 320-char exception in the prompt contract', () => {
    expect(DAILY_REVIEW_PROMPT_VERSION).toBe('daily-review-v3');
    expect(DAILY_REVIEW_SYSTEM_PROMPT).toContain('260');
    expect(DAILY_REVIEW_SYSTEM_PROMPT).toContain('320');
  });
});
