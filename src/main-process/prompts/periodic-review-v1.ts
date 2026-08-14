import { z } from 'zod';
import type { PeriodicEvidenceGrade, PeriodicReviewType } from '../skill-runtime/periodic-evidence';

export const PERIODIC_REVIEW_PROMPT_VERSION = 'periodic-review-v2';

const REVIEW_LABELS: Record<PeriodicReviewType, string> = {
  weekly: '周报',
  monthly: '月报',
  project: '项目复盘',
};

export function periodicSystemPrompt(type: PeriodicReviewType, grade: Exclude<PeriodicEvidenceGrade, 'D'>): string {
  const label = REVIEW_LABELS[type];
  const gradeRule = grade === 'A'
    ? '本次是 A 级证据：材料充足，可完整回答复盘六问。'
    : grade === 'B'
      ? `本次是 B 级证据：下游沉淀不足，只保留核心洞察；不得推断未经材料支持的长期模式。`
      : `本次是 C 级证据：只有原始日志没有下游沉淀，只镜像可核验事实；不得推断根因、动机或长期模式。`;
  return `你是知己 Skill 的${label}分析器。只依据给定材料和用户明确允许使用的个人背景，不得编造事实。${gradeRule}

材料按“下游沉淀优先”组织：materials.primary 是主材料（日反馈或周复盘等已沉淀复盘，或仅有原始日志时的日志）；materials.supplement 仅在主材料不足时补充原始日志全文；materials.journalIndex 是原始日志索引，只用于核对日期与引用，不是默认主输入。优先依据 primary 下结论；只有 primary 引用缺失、证据冲突或关键判断需要补证时，才引用 supplement 与 journalIndex 中的日志。

执行复盘六问：结果是什么；什么行为有效；什么无效；有哪些证据或矛盾；重来会如何选择；下一项可验证行动是什么。行动必须在五分钟内可启动且无需再次拆解；预测必须是下一周期内可观察的真实行为或结果。

不得做确定性心理归因，不得把单一事件拔高为价值观。所有文字合计应能排版在 800 个中文字符内。

只返回一个 JSON 对象，不要 Markdown、代码块或额外说明。字段必须严格符合：
{
  "summary": "本期主要成果和状态",
  "effectiveActions": "什么行为有效，附证据",
  "ineffectiveActions": "什么无效，附证据",
  "evidenceAndConflicts": "有哪些证据或矛盾",
  "ifRedone": "重来会如何选择",
  "nextAction": { "step": "五分钟内可启动的行动", "prediction": "下一周期内可观察的行为或结果" }
}`;
}

export const PeriodicReviewOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  effectiveActions: z.string().min(1).max(2000),
  ineffectiveActions: z.string().min(1).max(2000),
  evidenceAndConflicts: z.string().min(1).max(2000),
  ifRedone: z.string().min(1).max(2000),
  nextAction: z.object({ step: z.string().min(1).max(1000), prediction: z.string().min(1).max(1000) }).strict(),
}).strict();

export type PeriodicReviewOutput = z.infer<typeof PeriodicReviewOutputSchema>;

export function parsePeriodicReviewOutput(raw: string): PeriodicReviewOutput {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return PeriodicReviewOutputSchema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}

export function renderPeriodicReview(output: PeriodicReviewOutput, type: PeriodicReviewType, start: string, end: string): string {
  const label = REVIEW_LABELS[type];
  return [
    `📋 ${label}（${start} ~ ${end}）`,
    `📊 结果`,
    output.summary,
    `✅ 有效`,
    output.effectiveActions,
    `❌ 无效`,
    output.ineffectiveActions,
    `🔍 证据与矛盾`,
    output.evidenceAndConflicts,
    `🔄 重来会怎样`,
    output.ifRedone,
    `⚡ 下一项行动`,
    `行动：${output.nextAction.step}`,
    `预测：${output.nextAction.prediction}`,
  ].join('\n\n');
}
