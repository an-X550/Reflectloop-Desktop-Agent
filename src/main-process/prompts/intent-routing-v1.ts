import { z } from 'zod';
import { WorkflowIntentSchema } from '../../shared/schemas/domain';

export const INTENT_ROUTING_PROMPT_VERSION = 'intent-routing-v1';

export function intentRoutingPrompt(): string {
  return `你是知己桌面端的意图路由器。你只能从下面的固定意图列表中选择一个，不得创建、改写或建议任何新流程。

固定意图：
- write-journal：写一条日志
- daily-review：生成或查看每日反馈
- weekly-review：周复盘或周报
- monthly-review：月复盘或月报
- project-review：项目复盘
- topic-thinking：讨论长期困惑、既有观点或价值判断

只返回一个 JSON 对象，不要 Markdown 代码块或额外说明：{"intent": "固定意图之一或 null", "reason": "一句话理由"}
如果用户输入不属于以上任何意图，intent 必须返回 null。`;
}

export const IntentRoutingOutputSchema = z.object({
  intent: WorkflowIntentSchema.nullable(),
  reason: z.string().trim().max(200),
}).strict();

export type IntentRoutingOutput = z.infer<typeof IntentRoutingOutputSchema>;

export function parseIntentRoutingOutput(raw: string): IntentRoutingOutput {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return IntentRoutingOutputSchema.parse(JSON.parse(fenced?.[1] ?? trimmed));
}
