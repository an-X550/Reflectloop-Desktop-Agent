import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { PERIODIC_REVIEW_COMPATIBILITY } from '../../src/main-process/skill-runtime/compatibility/periodic-review-v1';
import { runPeriodicFeedback } from '../../src/main-process/skill-runtime/periodic-runtime';
import type { Journal, Review } from '../../src/shared/schemas/domain';

async function runtimeSources(folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/main-process/skill-runtime')): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) return runtimeSources(target);
    return entry.name.endsWith('.ts') ? [await readFile(target, 'utf8')] : [];
  }));
  return sources.flat();
}

const journal = (date: string, body = '完成了任务'): Journal => ({
  schemaVersion: 1, id: `journal_${date}`, date, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`, projectIds: [], body,
});

const dailyReview = (date: string): Review => ({
  schemaVersion: 2, id: `review_${date}`, type: 'daily', periodStart: date, periodEnd: date, sourceIds: [], sourceVersions: [], projectId: null, provider: 'openai-compatible', model: 'fake', promptVersion: 'daily-review-v2', createdAt: `${date}T10:00:00.000Z`, body: '反馈',
});

describe('runPeriodicFeedback', () => {
  it('uses a frozen desktop compatibility snapshot without reading .claude', () => {
    expect(PERIODIC_REVIEW_COMPATIBILITY.id).toBe('desktop-periodic-review-v2');
    expect(PERIODIC_REVIEW_COMPATIBILITY.runtimeReadsClaudeDirectory).toBe(false);
    expect(PERIODIC_REVIEW_COMPATIBILITY.supports).toContain('downstream-first materials');
    expect(PERIODIC_REVIEW_COMPATIBILITY.supports).toContain('direction-anchor absence check with five states');
    expect(PERIODIC_REVIEW_COMPATIBILITY.materialCategories).toEqual(['target-journals', 'daily-reviews', 'weekly-reviews', 'verified-patterns']);
  });

  it('keeps the periodic runtime independent from the Codex Skill directory', async () => {
    const sources = await runtimeSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources).not.toContainEqual(expect.stringContaining('.claude'));
  });

  it('stops D-grade input with one clarification before calling the model', async () => {
    const collect = vi.fn();
    const result = await runPeriodicFeedback({
      type: 'weekly', start: '2026-08-10', end: '2026-08-16',
      journals: [], reviews: [], provider: { collect },
    });
    expect(result).toEqual({ kind: 'clarification', grade: 'D', question: expect.any(String) });
    expect(collect).not.toHaveBeenCalled();
  });

  it('routes evidence-ready input through the model once and renders a review', async () => {
    const collect = vi.fn().mockResolvedValue(JSON.stringify({
      chatSummary: '完成三个功能',
      goalReview: '目标是交付切片',
      resultEvaluation: '目标达成',
      causesPositive: '上午关消息有效',
      causesNegative: '晚间加班效果递减',
      ifRedone: '会把测试前置',
      nextPlan: { goal: '完成下一切片', means: '按 TDD 实施', check: '全量测试通过' },
      directionAnchors: [{ name: '作息稳定', status: '有推进', note: '日志记录早睡' }],
      qualitySelfCheck: '质量门已通过；无影响本次判断的已知缺口。',
    }));
    const result = await runPeriodicFeedback({
      type: 'weekly', start: '2026-08-10', end: '2026-08-16',
      journals: [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')],
      reviews: [dailyReview('2026-08-10'), dailyReview('2026-08-11'), dailyReview('2026-08-12')],
      provider: { collect },
    });
    expect(result).toMatchObject({ kind: 'review', grade: 'A' });
    expect(collect).toHaveBeenCalledOnce();
    if (result.kind === 'review') expect(result.body).toContain('## 一、回顾目标');
  });

  it('discloses the B-grade downgrade in the rendered quality self-check', async () => {
    const collect = vi.fn().mockResolvedValue(JSON.stringify({
      chatSummary: '完成部分功能',
      goalReview: '目标是交付切片',
      resultEvaluation: '部分达成',
      causesPositive: '上午专注有效',
      causesNegative: '无新增判断',
      ifRedone: '会更早开始测试',
      nextPlan: { goal: '补齐测试', means: '先写失败测试', check: '下次复盘核对' },
      directionAnchors: [],
      qualitySelfCheck: '质量门已通过；无影响本次判断的已知缺口。',
    }));
    const result = await runPeriodicFeedback({
      type: 'weekly', start: '2026-08-10', end: '2026-08-16',
      journals: [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')],
      reviews: [dailyReview('2026-08-10'), dailyReview('2026-08-11')],
      provider: { collect },
    });
    expect(result).toMatchObject({ kind: 'review', grade: 'B' });
    if (result.kind === 'review') {
      expect(result.body).toContain('证据等级 B');
      expect(result.body).toContain('方向锚点不足');
    }
  });

  it('rejects invalid model output', async () => {
    const collect = vi.fn().mockResolvedValue('not json');
    await expect(runPeriodicFeedback({
      type: 'weekly', start: '2026-08-10', end: '2026-08-16',
      journals: [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')],
      reviews: [dailyReview('2026-08-10'), dailyReview('2026-08-11'), dailyReview('2026-08-12')],
      provider: { collect },
    })).rejects.toThrow();
  });
});
