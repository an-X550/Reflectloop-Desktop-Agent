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
    expect(PERIODIC_REVIEW_COMPATIBILITY.id).toBe('desktop-periodic-review-v1');
    expect(PERIODIC_REVIEW_COMPATIBILITY.runtimeReadsClaudeDirectory).toBe(false);
    expect(PERIODIC_REVIEW_COMPATIBILITY.supports).toContain('downstream-first materials');
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
      summary: '完成了三个功能',
      effectiveActions: '上午关消息有效',
      ineffectiveActions: '晚间加班效果递减',
      evidenceAndConflicts: '周二效率最高',
      ifRedone: '会把测试前置',
      nextAction: { step: '写下周一计划', prediction: '下周一会直接开始' },
    }));
    const result = await runPeriodicFeedback({
      type: 'weekly', start: '2026-08-10', end: '2026-08-16',
      journals: [journal('2026-08-10'), journal('2026-08-11'), journal('2026-08-12')],
      reviews: [dailyReview('2026-08-10'), dailyReview('2026-08-11'), dailyReview('2026-08-12')],
      provider: { collect },
    });
    expect(result).toMatchObject({ kind: 'review', grade: 'A' });
    expect(collect).toHaveBeenCalledOnce();
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
