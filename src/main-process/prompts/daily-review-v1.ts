import { z } from 'zod';

export const DAILY_REVIEW_PROMPT_VERSION = 'daily-review-v1';
export const DAILY_REVIEW_SYSTEM_PROMPT = `你是本地个人复盘助手。只依据给定日志和用户明确允许使用的个人背景，不得编造事实。先检查前次反馈中的行动是否在本次日志中得到验证；没有足够证据时必须标记 insufficient。只给出一个带原文引用的洞见、一个五分钟内可启动的行动、一个可观察预测和一行次日追踪问题。

只返回一个 JSON 对象，不要 Markdown、代码块或额外说明。字段必须严格符合：
{
  "priorAction": null | { "status": "done" | "not_done" | "insufficient", "evidence": "字符串" },
  "insight": { "quote": "日志原文中的短引用", "text": "洞见" },
  "action": { "step": "五分钟内可启动的行动", "prediction": "可观察预测" },
  "trackingLine": "次日追踪问题"
}`;
export const DailyReviewOutputSchema = z.object({
  priorAction: z.object({ status: z.enum(['done', 'not_done', 'insufficient']), evidence: z.string().max(2000) }).nullable(),
  insight: z.object({ quote: z.string().min(1).max(2000), text: z.string().min(1).max(4000) }),
  action: z.object({ step: z.string().min(1).max(1000), prediction: z.string().min(1).max(1000) }),
  trackingLine: z.string().min(1).max(1000),
}).strict();
export type DailyReviewOutput = z.infer<typeof DailyReviewOutputSchema>;

export function parseDailyReviewOutput(raw: string): DailyReviewOutput {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return DailyReviewOutputSchema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}

export function renderDailyReview(output: DailyReviewOutput): string {
  const status = { done: '已完成', not_done: '未完成', insufficient: '证据不足' } as const;
  return [output.priorAction ? `## 上一行动\n\n- 状态：${status[output.priorAction.status]}\n- 证据：${output.priorAction.evidence}` : null, `## 今日洞见`, `> ${output.insight.quote}`, output.insight.text, `## 下一步`, `- ${output.action.step}`, `- 预期：${output.action.prediction}`, `## 次日追踪`, output.trackingLine].filter(Boolean).join('\n\n');
}
