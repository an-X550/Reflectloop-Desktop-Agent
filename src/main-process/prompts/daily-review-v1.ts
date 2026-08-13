import { z } from 'zod';

export const DAILY_REVIEW_PROMPT_VERSION = 'daily-review-v1';
export const DAILY_REVIEW_SYSTEM_PROMPT = `你是本地个人复盘助手。只依据给定日志和用户明确允许使用的个人背景，返回严格 JSON，不得编造事实。先检查前次反馈中的行动是否在本次日志中得到验证；没有足够证据时必须标记 insufficient。只给出一个带原文引用的洞见、一个五分钟内可启动的行动、一个可观察预测和一行次日追踪问题。`;
export const DailyReviewOutputSchema = z.object({
  priorAction: z.object({ status: z.enum(['done', 'not_done', 'insufficient']), evidence: z.string().max(2000) }).nullable(),
  insight: z.object({ quote: z.string().min(1).max(2000), text: z.string().min(1).max(4000) }),
  action: z.object({ step: z.string().min(1).max(1000), prediction: z.string().min(1).max(1000) }),
  trackingLine: z.string().min(1).max(1000),
}).strict();
export type DailyReviewOutput = z.infer<typeof DailyReviewOutputSchema>;

export function renderDailyReview(output: DailyReviewOutput): string {
  const status = { done: '已完成', not_done: '未完成', insufficient: '证据不足' } as const;
  return [output.priorAction ? `## 上一行动\n\n- 状态：${status[output.priorAction.status]}\n- 证据：${output.priorAction.evidence}` : null, `## 今日洞见`, `> ${output.insight.quote}`, output.insight.text, `## 下一步`, `- ${output.action.step}`, `- 预期：${output.action.prediction}`, `## 次日追踪`, output.trackingLine].filter(Boolean).join('\n\n');
}
