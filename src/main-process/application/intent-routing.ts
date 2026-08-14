import type { IntentResolution, WorkflowIntent } from '../../shared/schemas/domain';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import { intentRoutingPrompt, parseIntentRoutingOutput } from '../prompts/intent-routing-v1';

interface ProviderPort { collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> }

interface DeterministicRule { intent: WorkflowIntent; pattern: RegExp; reason: string }

/**
 * 确定性规则按从具体到一般的顺序匹配：月度关键词先于周度，避免“这个月的周复盘”被误判。
 */
const RULES: DeterministicRule[] = [
  { intent: 'monthly-review', pattern: /月报|月度复盘|月复盘|(\d{1,2}|[一二三四五六七八九十两])\s*月(?!刊)|这个月|上个月|本月/, reason: '命中月度复盘关键词' },
  { intent: 'weekly-review', pattern: /周报|周复盘|本周|这周|上周/, reason: '命中周复盘关键词' },
  { intent: 'project-review', pattern: /项目复盘|项目验收|复盘.{0,8}项目/, reason: '命中项目复盘关键词' },
  { intent: 'daily-review', pattern: /每日反馈|日反馈|今日复盘|今天复盘/, reason: '命中每日反馈关键词' },
  { intent: 'topic-thinking', pattern: /主题|困惑|想不通|思考一下|探讨/, reason: '命中主题思考关键词' },
  { intent: 'write-journal', pattern: /写日志|写一条|记录今天|记一笔/, reason: '命中写日志关键词' },
];

/** 确定性意图匹配：命中固定规则直接返回，不调用模型；无规则命中返回 null。 */
export function matchIntentDeterministic(text: string): WorkflowIntent | null {
  return findDeterministicRule(text)?.intent ?? null;
}

function findDeterministicRule(text: string): DeterministicRule | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return RULES.find((rule) => rule.pattern.test(trimmed));
}

const CLARIFY_QUESTION = '没有识别出你想做的事。你是想写日志、生成每日反馈、做周/月/项目复盘，还是讨论一个主题？';

/**
 * 意图路由：先确定性匹配；未命中时模型只能从固定 WorkflowIntent 枚举选择；
 * Zod 校验失败或模型返回 null 一律回退澄清，绝不猜测或创建新流程。
 */
export class IntentRoutingService {
  constructor(private readonly provider: ProviderPort) {}

  async resolve(input: { text: string; model: string }): Promise<IntentResolution> {
    const rule = findDeterministicRule(input.text);
    if (rule) return { kind: 'matched', intent: rule.intent, source: 'deterministic', reason: rule.reason };
    const raw = await this.provider.collect([
      { role: 'system', content: intentRoutingPrompt() },
      { role: 'user', content: input.text.trim() },
    ], undefined, { jsonObject: true });
    let output: ReturnType<typeof parseIntentRoutingOutput>;
    try {
      output = parseIntentRoutingOutput(raw);
    } catch {
      return { kind: 'clarify', question: CLARIFY_QUESTION };
    }
    if (!output.intent) return { kind: 'clarify', question: CLARIFY_QUESTION };
    return { kind: 'matched', intent: output.intent, source: 'model', reason: output.reason };
  }
}

export { WorkflowIntentSchema } from '../../shared/schemas/domain';
