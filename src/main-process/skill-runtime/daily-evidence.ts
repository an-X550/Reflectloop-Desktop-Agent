import type { Journal } from '../../shared/schemas/domain';

export type DailyEvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface DailyEvidence {
  grade: DailyEvidenceGrade;
  facts: string[];
  states: string[];
  interpretations: string[];
  intentions: string[];
  gaps: string[];
}

const sentences = (journals: Journal[]) => journals
  .flatMap((journal) => journal.body.split(/[。！？\n]+/))
  .map((sentence) => sentence.trim())
  .filter(Boolean);

const unique = (items: string[]) => [...new Set(items)];

export function buildDailyEvidence(journals: Journal[]): DailyEvidence {
  const items = sentences(journals);
  const facts = unique(items.filter((item) => /(完成|做了|去了|写了|开始|结束|提交|收到|见了|学习|工作|开会|运动|吃了|睡了|发生|处理)/.test(item)));
  const states = unique(items.filter((item) => /(感到|感觉|觉得|很累|轻松|开心|难过|焦虑|疲惫|烦|困|有精神|低落)/.test(item)));
  const interpretations = unique(items.filter((item) => /(我发现|我意识到|说明|因为|所以|有效|没用|问题是|原来)/.test(item)));
  const intentions = unique(items.filter((item) => /(明天|接下来|以后|继续|准备|打算|要|尝试)/.test(item)));
  const hasPersonalExperience = facts.length > 0 || states.length > 0 || items.some((item) => /我/.test(item) && item.length >= 5);
  const gaps: string[] = [];

  if (!hasPersonalExperience) gaps.push('缺少可确认的本人经历或具体事件');
  if (!facts.length) gaps.push('缺少具体事实或行为');
  if (!states.length) gaps.push('缺少明确状态');
  if (!interpretations.length) gaps.push('缺少用户自己的解释');
  if (!intentions.length) gaps.push('缺少行动意图或上一行动结果');

  const grade: DailyEvidenceGrade = !hasPersonalExperience
    ? 'D'
    : facts.length > 0 && states.length > 0 && interpretations.length > 0 && intentions.length > 0
      ? 'A'
      : facts.length > 0 && (states.length > 0 || interpretations.length > 0)
        ? 'B'
        : 'C';

  return { grade, facts, states, interpretations, intentions, gaps };
}
