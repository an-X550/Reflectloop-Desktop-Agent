import { z } from 'zod';
import { parseFencedJson } from './parse-fenced-json';

export const VERIFIED_PATTERNS_PROMPT_VERSION = 'verified-patterns-v1';

export const MAX_PATTERN_CANDIDATES = 3;

export function verifiedPatternsSystemPrompt(): string {
  return `你是知己 Skill 的验证模式助手。从给定的一篇复盘中提取 0-${MAX_PATTERN_CANDIDATES} 条可被未来验证的行为假说候选。

规则：
- 每条候选必须是“某种情境与行为、状态或结果之间可能存在的关系”，可以被用户反驳，不是权威诊断。
- 证据摘要必须来自复盘文本中实际出现的内容，不得编造日期、次数或引文。
- 不得做人格归纳、心理归因或价值观拔高；单条复盘不足以确认长期模式，你只提出候选，由用户决定是否沉淀。
- 没有值得验证的候选时返回空数组。

只返回一个 JSON 对象，不要 Markdown、代码块或额外说明。字段必须严格符合：
{
  "candidates": [
    { "statement": "可验证的行为假说", "evidenceSummary": "复盘中的对应证据" }
  ]
}`;
}

export const VerifiedPatternsOutputSchema = z.object({
  candidates: z.array(z.object({
    statement: z.string().trim().min(1).max(500),
    evidenceSummary: z.string().trim().min(1).max(1000),
  }).strict()).max(10),
}).strict();

export type VerifiedPatternsOutput = z.infer<typeof VerifiedPatternsOutputSchema>;

export function parseVerifiedPatternsOutput(raw: string): VerifiedPatternsOutput {
  return parseFencedJson(raw, VerifiedPatternsOutputSchema);
}
