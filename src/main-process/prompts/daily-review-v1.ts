import { z } from 'zod';

export const DAILY_REVIEW_PROMPT_VERSION = 'daily-review-v1';
export const DAILY_REVIEW_SYSTEM_PROMPT = `你是本地个人复盘助手。只依据给定日志，返回 JSON，不得编造事实。给出一个有证据的洞见、一个五分钟内可启动的行动、一个可观察预测和一行次日追踪问题。`;
export const DailyReviewOutputSchema = z.object({
  priorAction: z.object({ status: z.enum(['done', 'not_done', 'insufficient']), evidence: z.string().max(2000) }).nullable(),
  insight: z.object({ quote: z.string().min(1).max(2000), text: z.string().min(1).max(4000) }),
  action: z.object({ step: z.string().min(1).max(1000), prediction: z.string().min(1).max(1000) }),
  trackingLine: z.string().min(1).max(1000),
}).strict();
export type DailyReviewOutput = z.infer<typeof DailyReviewOutputSchema>;

export function renderDailyReview(output: DailyReviewOutput): string {
  return [`## 今日洞见`, `> ${output.insight.quote}`, output.insight.text, `## 下一步`, `- ${output.action.step}`, `- 预期：${output.action.prediction}`, `## 次日追踪`, output.trackingLine].join('\n\n');
}
