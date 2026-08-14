import crypto from 'node:crypto';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { Journal, Review } from '../../shared/schemas/domain';
import { appError } from '../../shared/errors/app-error';
import { buildDailyContext } from '../domain/daily-context';
import type { ChatMessage, CollectOptions } from '../infrastructure/ai/openai-compatible-provider';
import { DAILY_REVIEW_SYSTEM_PROMPT, parseDailyReviewOutput, renderDailyReview, type DailyReviewOutput } from '../prompts/daily-review-v1';
import { buildDailyEvidence, type DailyEvidence, type DailyEvidenceGrade } from './daily-evidence';
import { confirmPersonalExperience } from './daily-grade-review';

export interface ProviderPort {
  collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string>;
}

export type DailyRuntimeResult =
  | { kind: 'review'; body: string; grade: Exclude<DailyEvidenceGrade, 'D'>; output: DailyReviewOutput }
  | { kind: 'clarification'; question: string; grade: 'D' };

interface RuntimeInput {
  journals: Journal[];
  reviews: Review[];
  provider: ProviderPort;
  profile?: string;
  signal?: AbortSignal;
}

interface RuntimeState {
  input: RuntimeInput;
  evidence?: DailyEvidence;
  result?: DailyRuntimeResult;
}

const DailyRuntimeState = Annotation.Root({
  input: Annotation<RuntimeInput>,
  evidence: Annotation<DailyEvidence | undefined>,
  result: Annotation<DailyRuntimeResult | undefined>,
});

function clarification(evidence: DailyEvidence): DailyRuntimeResult {
  const missing = evidence.gaps[0] ?? '缺少可用于分析的具体经历';
  return { kind: 'clarification', grade: 'D', question: `为了给你有依据的反馈，请补充：${missing}。` };
}

function gradeInstruction(grade: Exclude<DailyEvidenceGrade, 'D'>): string {
  if (grade === 'B') return '本次是 B 级证据：只保留一个核心洞察；没有明确跨日证据时 patternConnection 必须为 null。';
  if (grade === 'C') return '本次是 C 级证据：只镜像可核验事实或状态，patternConnection 必须为 null；不得推断根因、动机或长期模式。';
  return '本次是 A 级证据：仅在给定材料支持时才可填写 patternConnection。';
}

async function generateReview(state: RuntimeState): Promise<Partial<RuntimeState>> {
  const evidence = state.evidence;
  if (!evidence || evidence.grade === 'D') throw new Error('日反馈工作流缺少可生成的证据等级。');
  const context = buildDailyContext(state.input.journals, state.input.reviews);
  const raw = await state.input.provider.collect([
    { role: 'system', content: `${DAILY_REVIEW_SYSTEM_PROMPT}\n\n${gradeInstruction(evidence.grade)}` },
    { role: 'user', content: JSON.stringify({ context, evidence, ...(state.input.profile ? { profile: state.input.profile } : {}) }) },
  ], state.input.signal, { jsonObject: true });
  let output: DailyReviewOutput;
  try { output = parseDailyReviewOutput(raw); }
  catch { throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的日反馈格式无效。' }); }
  const normalized = evidence.grade === 'C' ? { ...output, patternConnection: null } : output;
  const date = state.input.journals[0]?.date;
  if (!date) throw new Error('日反馈工作流缺少日志日期。');
  return { result: { kind: 'review', grade: evidence.grade, body: renderDailyReview(normalized, date), output: normalized } };
}

async function reviewGrade(state: RuntimeState): Promise<Partial<RuntimeState>> {
  const evidence = state.evidence;
  if (!evidence || evidence.grade !== 'D') return {};
  const confirmed = await confirmPersonalExperience(state.input.provider, state.input.journals, state.input.signal);
  if (!confirmed) return {};
  // 保守升级：只升到 C（镜像反射级），不跳 A/B，避免过度修正
  return { evidence: { ...evidence, grade: 'C' } };
}

export async function runDailyFeedback(input: RuntimeInput): Promise<DailyRuntimeResult> {
  const graph = new StateGraph(DailyRuntimeState)
    .addNode('build_evidence', (state) => ({ evidence: buildDailyEvidence(state.input.journals) }))
    .addNode('review_grade', reviewGrade)
    .addNode('clarify', (state) => ({ result: clarification(state.evidence ?? buildDailyEvidence(state.input.journals)) }))
    .addNode('generate', generateReview)
    .addEdge(START, 'build_evidence')
    .addConditionalEdges('build_evidence', (state) => state.evidence?.grade === 'D' ? 'review_grade' : 'generate')
    .addConditionalEdges('review_grade', (state) => state.evidence?.grade === 'D' ? 'clarify' : 'generate')
    .addEdge('clarify', END)
    .addEdge('generate', END)
    .compile({ checkpointer: new MemorySaver() });
  const result = await graph.invoke({ input }, { configurable: { thread_id: `daily-${crypto.randomUUID()}` } });
  if (!result.result) throw new Error('日反馈工作流没有返回结果。');
  return result.result;
}
