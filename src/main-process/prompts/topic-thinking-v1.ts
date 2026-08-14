import { z } from 'zod';

export const TOPIC_THINKING_PROMPT_VERSION = 'topic-thinking-v2';

const SHARED_RULES = `你在知己桌面端与用户讨论一个长期困惑、既有观点或价值判断。

规则：
- 只回答当前问题，按主线组织：问题 → 可回查事实与关键约束 → 当前判断（含反例、代价或未知） → 验证、继续讨论、确认沉淀或等待。
- 清楚区分事实、推断、价值取舍与未知；证据不足时说明证据缺口、反例或替代解释，不得编造因果。
- 行动必须处于用户可控范围，写明触发条件、最小动作和可观察的继续、调整或停止条件；推不出时写“当前不行动”及等待条件。
- 不得做人格标签、心理诊断，不得把用户价值选择写成唯一客观答案。
- 用中文回复，直接给出内容，不要解释你在遵守什么规则。`;

export function topicFirstDraftPrompt(): string {
  return `${SHARED_RULES}

这是首次讨论。如果用户消息中带 referencedTopics，它们是用户既有的相关主题认识，最多两条；参考时明确说出参考了哪条，当前表达优先于历史认识。
如果用户消息中带 contextExcerpt，以下为相关背景摘录（来自日反馈或复盘结果，最多 500 字），可回查引用；它只是背景，不改变主线要求。`;
}

export function topicDiscussPrompt(): string {
  return `${SHARED_RULES}

这是继续讨论。回应用户带来的新信息：它补强、修正还是反驳了当前判断？必要时更新判断主线，不要重复已经说过的内容。`;
}

export function topicSummaryPrompt(existingBody?: string): string {
  const mergeRule = existingBody
    ? '\n用户消息中会带 existingBody，这是该主题的既有正文。请结合本轮对话，重组整篇当前论证而非仅写新内容；可改写、移动、合并或删除旧内容，不追加与当前判断无关的历史内容。'
    : '';
  return `你是知己 Skill 的主题归纳器。把对话中用户已经明确认可的认识归纳为一篇可长期保留的主题文件。${mergeRule}

规则：
- 只归纳用户在对话中明确表达或认可的判断；AI 单方面观点不得写成用户认识。
- 保留证据缺口、反例、推理跳跃或价值冲突；区分事实、推断与价值取舍。
- 正文使用 Markdown，包含“当前判断”“依据来源”“值得保留的行动或等待条件”三部分；没有合格行动时写“当前不行动”及等待条件。
- 不要编造对话中不存在的证据、日期或引文。

只返回一个 JSON 对象，不要 Markdown 代码块或额外说明。字段必须严格符合：
{
  "title": "主题短标题",
  "coreQuestion": "这篇主题回答的唯一核心问题",
  "aliases": ["最多 3 个近义叫法"],
  "body": "完整 Markdown 正文"
}`;
}

export const TopicSummaryOutputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  coreQuestion: z.string().trim().min(1).max(500),
  aliases: z.array(z.string().trim().min(1).max(80)).max(3),
  body: z.string().trim().min(1).max(20_000),
}).strict();

export type TopicSummaryOutput = z.infer<typeof TopicSummaryOutputSchema>;

export function parseTopicSummaryOutput(raw: string): TopicSummaryOutput {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return TopicSummaryOutputSchema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}
