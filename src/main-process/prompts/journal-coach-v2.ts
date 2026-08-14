import { z } from 'zod';
import { parseFencedJson } from './parse-fenced-json';

const text = z.string().min(1).max(1000);
export const JOURNAL_COACH_PROMPT_VERSION = 'journal-coach-v3';
export const JOURNAL_COACH_SYSTEM_PROMPT = `你是知己 Skill 的日志质量教练。评估日志材料质量，不评估用户的人生质量，也不替代单日日反馈。

必须分开判断：
1. 分析就绪度：逐篇按 A-D 判断。A=事实、状态、解释、行动或验证充分；B=有具体事实且有状态或解释；C=只有简短事实、情绪或片段；D=无法确认日期、本人经历或具体事件。
2. 六步法写作习惯：回忆事实、筛选重点、评估结果、洞察思考、行为改进、分享讨论（可选增强）。自由叙事中的等价证据有效，不因缺少固定栏目扣分；未分享只能写“未观察到”。

汇总最稳定证据、最常缺少证据、重复写作问题，只给一个不要求改用固定模板的低摩擦动作。不得做心理诊断或长篇生活建议。只有材料同时出现至少两类方向性信号时才填写 directionWarning，否则返回 null。方向性信号仅限四类：反复怀疑长期方向、同一行动连续失效、目标与能量持续冲突、长期失衡被合理化为“没办法”。单日情绪低落或普通任务压力不触发。

只返回 JSON 对象，不要 Markdown、代码块或额外说明。严格字段：
{
  "summary": ["2到3条关键判断"],
  "entries": [{"date":"YYYY-MM-DD","readiness":"A|B|C|D","evidence":"主要证据","missing":"最值得补充"}],
  "sixSteps": [{"date":"YYYY-MM-DD","facts":"判断","focus":"判断","feelings":"判断","thinking":"判断","action":"判断","sharing":"判断"}],
  "patterns": {"stable":"最稳定的证据","missing":"最常缺少的证据","issue":"重复写作问题"},
  "priorityAction":"一件低摩擦动作",
  "directionWarning": null | "方向性卡点提醒"
}`;

export const JournalCoachOutputSchema = z.object({
  summary: z.array(text).min(2).max(3),
  entries: z.array(z.object({ date: z.string().date(), readiness: z.enum(['A', 'B', 'C', 'D']), evidence: text, missing: text }).strict()).min(3).max(40),
  sixSteps: z.array(z.object({ date: z.string().date(), facts: text, focus: text, feelings: text, thinking: text, action: text, sharing: text }).strict()).min(3).max(40),
  patterns: z.object({ stable: text, missing: text, issue: text }).strict(),
  priorityAction: text,
  directionWarning: text.nullable(),
}).strict();
export type JournalCoachOutput = z.infer<typeof JournalCoachOutputSchema>;

export function parseJournalCoachOutput(raw: string): JournalCoachOutput {
  return parseFencedJson(raw, JournalCoachOutputSchema);
}

function cell(value: string) { return value.replace(/\|/g, '｜').replace(/\r?\n/g, ' '); }
export function renderJournalCoach(output: JournalCoachOutput, start: string, end: string): string {
  return [
    `# 日志教练报告：${start}..${end}`,
    `## 聊天摘要\n\n${output.summary.map((item) => `- ${item}`).join('\n')}`,
    `## 分析就绪度\n\n| 日期 | 等级 | 已有证据 | 最值得补充 |\n|---|---|---|---|\n${output.entries.map((item) => `| ${item.date} | ${item.readiness} | ${cell(item.evidence)} | ${cell(item.missing)} |`).join('\n')}`,
    `## 六步法写作习惯\n\n| 日期 | 事实 | 重点 | 感受 | 思考 | 行动 | 分享（可选） |\n|---|---|---|---|---|---|---|\n${output.sixSteps.map((item) => `| ${item.date} | ${cell(item.facts)} | ${cell(item.focus)} | ${cell(item.feelings)} | ${cell(item.thinking)} | ${cell(item.action)} | ${cell(item.sharing)} |`).join('\n')}`,
    `## 重复模式\n\n- 最稳定的证据：${output.patterns.stable}\n- 最常缺少的证据：${output.patterns.missing}\n- 重复写作问题：${output.patterns.issue}`,
    `## 优先改进的一件事\n\n${output.priorityAction}`,
    output.directionWarning ? `⚠️ ${output.directionWarning}` : null,
  ].filter(Boolean).join('\n\n');
}
