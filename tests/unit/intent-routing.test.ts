import { describe, expect, it, vi } from 'vitest';
import { IntentRoutingService, matchIntentDeterministic, WorkflowIntentSchema } from '../../src/main-process/application/intent-routing';

const provider = (reply: string) => ({ collect: vi.fn(async () => reply) });

describe('matchIntentDeterministic', () => {
  it('matches registered workflows by keywords without a model', () => {
    expect(matchIntentDeterministic('帮我做本周复盘')).toBe('weekly-review');
    expect(matchIntentDeterministic('生成 2026-W32 周报')).toBe('weekly-review');
    expect(matchIntentDeterministic('六月复盘')).toBe('monthly-review');
    expect(matchIntentDeterministic('生成 2026 年 6 月月报')).toBe('monthly-review');
    expect(matchIntentDeterministic('对桌面端做项目复盘')).toBe('project-review');
    expect(matchIntentDeterministic('今天的每日反馈做得怎么样')).toBe('daily-review');
    expect(matchIntentDeterministic('我想聊聊职业选择的困惑')).toBe('topic-thinking');
    expect(matchIntentDeterministic('写一条日志记录今天')).toBe('write-journal');
  });

  it('prefers the more specific periodic intent over generic wording', () => {
    expect(matchIntentDeterministic('复盘一下这个月的周复盘质量')).toBe('monthly-review');
  });

  it('returns null when no deterministic rule applies', () => {
    expect(matchIntentDeterministic('你好呀')).toBeNull();
    expect(matchIntentDeterministic('')).toBeNull();
  });
});

describe('IntentRoutingService', () => {
  it('returns deterministic matches without calling the model', async () => {
    const collect = provider('ignored');
    const service = new IntentRoutingService(collect);
    const result = await service.resolve({ text: '本周复盘', model: 'fake' });
    expect(result).toMatchObject({ kind: 'matched', intent: 'weekly-review', source: 'deterministic' });
    expect(collect.collect).not.toHaveBeenCalled();
  });

  it('falls back to the model and only accepts fixed enum intents', async () => {
    const collect = provider(JSON.stringify({ intent: 'weekly-review', reason: '用户想回顾一周' }));
    const service = new IntentRoutingService(collect);
    const result = await service.resolve({ text: '帮我看看最近这段时间', model: 'fake' });
    expect(result).toMatchObject({ kind: 'matched', intent: 'weekly-review', source: 'model' });
    expect(collect.collect).toHaveBeenCalledTimes(1);
  });

  it('clarifies when the model invents an intent outside the enum', async () => {
    const collect = provider(JSON.stringify({ intent: 'auto-coach-new-flow', reason: '新流程' }));
    const service = new IntentRoutingService(collect);
    const result = await service.resolve({ text: '帮我看看最近这段时间', model: 'fake' });
    expect(result.kind).toBe('clarify');
    if (result.kind === 'clarify') expect(result.question.length).toBeGreaterThan(0);
    expect(WorkflowIntentSchema.safeParse('auto-coach-new-flow').success).toBe(false);
  });

  it('clarifies instead of guessing when the model output fails Zod validation', async () => {
    const collect = provider('这不是 JSON');
    const service = new IntentRoutingService(collect);
    const result = await service.resolve({ text: '嗯……', model: 'fake' });
    expect(result.kind).toBe('clarify');
  });
});
