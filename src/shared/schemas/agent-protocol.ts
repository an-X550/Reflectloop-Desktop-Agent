import { z } from 'zod';
import { AgentMessageSchema, AgentSessionIdSchema, AgentSessionSchema } from './agent';
import { AgentNavigationTargetSchema, AgentPresentationCardSchema, AgentToolBridgeRequestSchema, AgentToolBridgeResponseSchema } from './agent-tools';

const RequestIdSchema = z.string().uuid();
const AgentTextSchema = z.string().trim().min(1).max(20_000);
const AgentDeltaSchema = z.string().max(20_000);
const ModelToolCallSchema = z.object({ id: z.string().trim().min(1).max(200), name: z.string().trim().min(1).max(200), arguments: z.string().max(20_000) }).strict();
const ModelMessageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.enum(['system', 'user']), content: AgentTextSchema }).strict(),
  z.object({ role: z.literal('assistant'), content: z.string().max(20_000), reasoning: z.string().max(100_000).optional(), toolCalls: z.array(ModelToolCallSchema).min(1).max(20).optional() }).strict(),
  z.object({ role: z.literal('tool'), content: z.string().max(20_000), toolCallId: z.string().trim().min(1).max(200) }).strict(),
]);
const ModelToolSchema = z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(2_000), parameters: z.record(z.string(), z.unknown()) }).strict();
const AgentRuntimeModelConfigSchema = z.object({ providerId: z.enum(['openai', 'deepseek', 'custom']), model: z.string().trim().min(1).max(160) }).strict();

export const AgentUtilityCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.start'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema }).strict(),
  z.object({ type: z.literal('session.list'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('session.send'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, message: AgentTextSchema }).strict(),
  z.object({ type: z.literal('session.cancel'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema }).strict(),
  z.object({ type: z.literal('session.delete'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema }).strict(),
  z.object({ type: z.literal('runtime.configure'), requestId: RequestIdSchema, config: AgentRuntimeModelConfigSchema }).strict(),
  z.object({ type: z.literal('runtime.shutdown'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('model.delta'), requestId: RequestIdSchema, delta: AgentDeltaSchema }).strict(),
  z.object({ type: z.literal('model.reasoning-delta'), requestId: RequestIdSchema, delta: AgentDeltaSchema }).strict(),
  z.object({ type: z.literal('model.tool-call'), requestId: RequestIdSchema, index: z.number().int().nonnegative(), callId: z.string().trim().min(1).max(200), name: z.string().trim().min(1).max(200).optional(), argumentsDelta: z.string().max(20_000) }).strict(),
  z.object({ type: z.literal('model.completed'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('model.failed'), requestId: RequestIdSchema, message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('model.cancelled'), requestId: RequestIdSchema }).strict(),
  AgentToolBridgeResponseSchema,
]);

export const AgentUtilityEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('runtime.ready') }).strict(),
  z.object({ type: z.literal('command.completed'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('command.failed'), requestId: RequestIdSchema, message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('session.snapshot'), session: AgentSessionSchema }).strict(),
  z.object({ type: z.literal('session.status'), sessionId: AgentSessionIdSchema, status: z.enum(['idle', 'running']) }).strict(),
  z.object({ type: z.literal('message.delta'), sessionId: AgentSessionIdSchema, messageId: RequestIdSchema, delta: AgentTextSchema }).strict(),
  z.object({ type: z.literal('message.completed'), sessionId: AgentSessionIdSchema, message: AgentMessageSchema }).strict(),
  z.object({ type: z.literal('model.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, messages: z.array(ModelMessageSchema).min(1).max(200), system: z.string().max(20_000).optional(), tools: z.array(ModelToolSchema).max(20).optional() }).strict(),
  z.object({ type: z.literal('model.cancel'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('runtime.error'), sessionId: AgentSessionIdSchema.optional(), message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('runtime.stopped') }).strict(),
  AgentToolBridgeRequestSchema,
  z.object({ type: z.literal('tool.activity'), sessionId: AgentSessionIdSchema, callId: z.string().trim().min(1).max(200), phase: z.enum(['started', 'completed', 'failed']), label: z.string().trim().min(1).max(120) }).strict(),
  z.object({ type: z.literal('tool.cancel'), sessionId: AgentSessionIdSchema, requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('ui.navigate'), sessionId: AgentSessionIdSchema, target: AgentNavigationTargetSchema }).strict(),
  z.object({ type: z.literal('ui.present'), sessionId: AgentSessionIdSchema, card: AgentPresentationCardSchema }).strict(),
]);

export type AgentUtilityCommand = z.infer<typeof AgentUtilityCommandSchema>;
export type AgentUtilityEvent = z.infer<typeof AgentUtilityEventSchema>;
export type AgentRuntimeModelConfig = z.infer<typeof AgentRuntimeModelConfigSchema>;
export type AgentModelRequest = Extract<AgentUtilityEvent, { type: 'model.request' }>;
export type AgentModelResponse = Extract<AgentUtilityCommand, { type: 'model.delta' | 'model.reasoning-delta' | 'model.tool-call' | 'model.completed' | 'model.failed' | 'model.cancelled' }>;
export type AgentRuntimeResponse = AgentModelResponse | Extract<AgentUtilityCommand, { type: 'tool.result' }>;
