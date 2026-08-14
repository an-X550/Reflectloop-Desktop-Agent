import { z } from 'zod';
import type { Journal } from '../../shared/schemas/domain';
import type { ProviderPort } from '../infrastructure/ai/provider-port';
import { parseFencedJson } from '../prompts/parse-fenced-json';

/**
 * D 级判级语义复核（兼容快照 desktop-daily-feedback-v3 登记行为）：
 * 仅当正则判 D 时追加至多一次短调用；确认本人经历则保守升至 C，
 * 失败、超时或输出无效一律回落原 D 判定，不阻塞补证闭环。
 */
export const GradeReviewSchema = z.object({
  hasFacts: z.boolean(),
  hasStates: z.boolean(),
  hasInterpretations: z.boolean(),
  hasIntentions: z.boolean(),
  hasPersonalExperience: z.boolean(),
}).strict();

export type GradeReviewOutput = z.infer<typeof GradeReviewSchema>;

const GRADE_REVIEW_SYSTEM_PROMPT = `你是日志证据判级复核器。只判断给定的日志文本能否确认为用户本人经历，不做任何建议、评价或扩写。
判断口径：
- facts：用户明确写出的事件、行为和结果
- states：用户明确写出的感受、能量或身体状态
- interpretations：用户自己的解释、判断或疑问
- intentions：用户想保持、停止或尝试的行为
- hasPersonalExperience：文本能否确认是用户本人的经历、行为、感受或评价；短小的第一人称评价也算本人经历
只返回一个 JSON 对象，字段为 hasFacts、hasStates、hasInterpretations、hasIntentions、hasPersonalExperience，全部为布尔值。`;

export function parseGradeReviewOutput(raw: string): GradeReviewOutput {
  return parseFencedJson(raw, GradeReviewSchema);
}

export async function confirmPersonalExperience(provider: ProviderPort, journals: Journal[], signal?: AbortSignal): Promise<boolean> {
  const text = journals.map((journal) => journal.body).join('\n\n').slice(0, 2000);
  try {
    const raw = await provider.collect([
      { role: 'system', content: GRADE_REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ], signal, { jsonObject: true });
    return parseGradeReviewOutput(raw).hasPersonalExperience;
  } catch {
    return false;
  }
}
