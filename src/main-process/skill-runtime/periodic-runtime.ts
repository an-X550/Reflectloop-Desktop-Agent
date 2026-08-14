import crypto from 'node:crypto';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { Journal, Review } from '../../shared/schemas/domain';
import { appError } from '../../shared/errors/app-error';
import type { ProviderPort } from '../infrastructure/ai/provider-port';
import { applyPeriodicQualityGates, periodicSystemPrompt, parsePeriodicReviewOutput, renderPeriodicReview, type PeriodicReviewOutput } from '../prompts/periodic-review-v1';
import { buildPeriodicEvidence, type PeriodicEvidence, type PeriodicEvidenceGrade, type PeriodicReviewType } from './periodic-evidence';
import { buildPeriodicModelMaterials } from './periodic-materials';

export type { ProviderPort };

export type PeriodicRuntimeResult =
  | { kind: 'review'; body: string; grade: Exclude<PeriodicEvidenceGrade, 'D'>; output: PeriodicReviewOutput }
  | { kind: 'clarification'; question: string; grade: 'D' };

interface RuntimeInput {
  type: PeriodicReviewType;
  start: string;
  end: string;
  journals: Journal[];
  reviews: Review[];
  provider: ProviderPort;
  profile?: string;
  signal?: AbortSignal;
}

interface RuntimeState {
  input: RuntimeInput;
  evidence?: PeriodicEvidence;
  result?: PeriodicRuntimeResult;
}

const PeriodicRuntimeState = Annotation.Root({
  input: Annotation<RuntimeInput>,
  evidence: Annotation<PeriodicEvidence | undefined>,
  result: Annotation<PeriodicRuntimeResult | undefined>,
});

function clarification(evidence: PeriodicEvidence): PeriodicRuntimeResult {
  const missing = evidence.gaps[0] ?? '缺少可用于复盘的材料';
  return { kind: 'clarification', grade: 'D', question: `为了给你有依据的复盘，请补充：${missing}。` };
}

async function generateReview(state: RuntimeState): Promise<Partial<RuntimeState>> {
  const evidence = state.evidence;
  if (!evidence || evidence.grade === 'D') throw appError({ code: 'UNKNOWN', message: '周期复盘工作流缺少可生成的证据等级。' });
  const { type, start, end, journals, reviews, provider, profile, signal } = state.input;
  const system = periodicSystemPrompt(type, evidence.grade);
  const payload = {
    type, period: { start, end },
    materials: buildPeriodicModelMaterials(type, journals, reviews),
    evidence,
    ...(profile ? { profile } : {}),
  };
  const raw = await provider.collect([
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ], signal, { jsonObject: true });
  let output: PeriodicReviewOutput;
  try { output = parsePeriodicReviewOutput(raw); }
  catch { throw appError({ code: 'INVALID_MODEL_OUTPUT', message: 'AI 返回的周期复盘格式无效。' }); }
  const gated = applyPeriodicQualityGates(output, evidence.grade, type);
  return { result: { kind: 'review', grade: evidence.grade, body: renderPeriodicReview(gated, type, start, end), output: gated } };
}

export async function runPeriodicFeedback(input: RuntimeInput): Promise<PeriodicRuntimeResult> {
  const graph = new StateGraph(PeriodicRuntimeState)
    .addNode('build_evidence', (state) => ({ evidence: buildPeriodicEvidence(state.input.type, state.input.journals, state.input.reviews) }))
    .addNode('clarify', (state) => ({ result: clarification(state.evidence ?? buildPeriodicEvidence(state.input.type, state.input.journals, state.input.reviews)) }))
    .addNode('generate', generateReview)
    .addEdge(START, 'build_evidence')
    .addConditionalEdges('build_evidence', (state) => state.evidence?.grade === 'D' ? 'clarify' : 'generate')
    .addEdge('clarify', END)
    .addEdge('generate', END)
    .compile({ checkpointer: new MemorySaver() });
  const result = await graph.invoke({ input }, { configurable: { thread_id: `periodic-${crypto.randomUUID()}` } });
  if (!result.result) throw appError({ code: 'UNKNOWN', message: '周期复盘工作流没有返回结果。' });
  return result.result;
}
