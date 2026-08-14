import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DAILY_FEEDBACK_COMPATIBILITY } from '../../src/main-process/skill-runtime/compatibility/daily-feedback-v1';
import { runDailyFeedback } from '../../src/main-process/skill-runtime/daily-runtime';
import type { Journal } from '../../src/shared/schemas/domain';

const journal = (body: string): Journal => ({
  schemaVersion: 1,
  id: 'journal_a1',
  date: '2026-08-13',
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
  projectIds: [],
  body,
});

async function runtimeSources(folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/main-process/skill-runtime')): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) return runtimeSources(target);
    return entry.name.endsWith('.ts') ? [await readFile(target, 'utf8')] : [];
  }));
  return sources.flat();
}

describe('desktop daily feedback runtime', () => {
  it('uses a frozen desktop compatibility snapshot without reading .claude', () => {
    expect(DAILY_FEEDBACK_COMPATIBILITY.id).toBe('desktop-daily-feedback-v2');
    expect(DAILY_FEEDBACK_COMPATIBILITY.materialCategories).toEqual([
      'target-journals',
      'previous-daily-review',
      'verified-patterns',
    ]);
    expect(DAILY_FEEDBACK_COMPATIBILITY.runtimeReadsClaudeDirectory).toBe(false);
  });

  it('keeps the desktop runtime independent from the Codex Skill directory', async () => {
    const sources = await runtimeSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources).not.toContainEqual(expect.stringContaining('.claude'));
  });

  it('stops D-grade input with one clarification before calling the model', async () => {
    const collect = vi.fn();
    const result = await runDailyFeedback({ journals: [journal('不知道。')], reviews: [], provider: { collect } });
    expect(result).toEqual({ kind: 'clarification', grade: 'D', question: expect.any(String) });
    expect(collect).not.toHaveBeenCalled();
  });

  it('routes evidence-ready input through the model once and renders a review', async () => {
    const collect = vi.fn().mockResolvedValue(JSON.stringify({
      priorAction: null,
      insight: { quote: '完成了报告', text: '先聚焦一个交付物让你看到进展。' },
      patternConnection: null,
      action: { step: '写下明天报告的第一行', prediction: '明早会直接开始报告。' },
      newInsight: '先启动能减少等待。',
    }));
    const result = await runDailyFeedback({
      journals: [journal('完成了报告，感到轻松。我发现上午先关消息有效，明天继续。')],
      reviews: [],
      provider: { collect },
    });
    expect(result).toMatchObject({ kind: 'review', grade: 'A' });
    expect(collect).toHaveBeenCalledOnce();
  });
});
