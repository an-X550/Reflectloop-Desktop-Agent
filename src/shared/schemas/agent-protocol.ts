import { z } from 'zod';
import { AgentMessageSchema, AgentSessionIdSchema } from './agent';

const RequestIdSchema = z.string().uuid();
const AgentTextSchema = z.string().trim().min(1).max(20_000);
const ModelMessageSchema = z.object({ role: z.enum(['system', 'user', 'assistant']), content: AgentTextSchema }).strict();

export const AgentUtilityCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.start'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema }).strict(),
  z.object({ type: z.literal('session.send'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, message: AgentTextSchema }).strict(),
  z.object({ type: z.literal('session.cancel'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema }).strict(),
  z.object({ type: z.literal('runtime.shutdown'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('model.delta'), requestId: RequestIdSchema, delta: AgentTextSchema }).strict(),
  z.object({ type: z.literal('model.completed'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('model.failed'), requestId: RequestIdSchema, message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('model.cancelled'), requestId: RequestIdSchema }).strict(),
]);

export const AgentUtilityEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('runtime.ready') }).strict(),
  z.object({ type: z.literal('command.completed'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('command.failed'), requestId: RequestIdSchema, message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('session.status'), sessionId: AgentSessionIdSchema, status: z.enum(['idle', 'running']) }).strict(),
  z.object({ type: z.literal('message.delta'), sessionId: AgentSessionIdSchema, messageId: RequestIdSchema, delta: AgentTextSchema }).strict(),
  z.object({ type: z.literal('message.completed'), sessionId: AgentSessionIdSchema, message: AgentMessageSchema }).strict(),
  z.object({ type: z.literal('model.request'), requestId: RequestIdSchema, sessionId: AgentSessionIdSchema, messages: z.array(ModelMessageSchema).min(1).max(200), system: z.string().max(20_000).optional() }).strict(),
  z.object({ type: z.literal('model.cancel'), requestId: RequestIdSchema }).strict(),
  z.object({ type: z.literal('runtime.error'), sessionId: AgentSessionIdSchema.optional(), message: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('runtime.stopped') }).strict(),
]);

export type AgentUtilityCommand = z.infer<typeof AgentUtilityCommandSchema>;
export type AgentUtilityEvent = z.infer<typeof AgentUtilityEventSchema>;
export type AgentModelRequest = Extract<AgentUtilityEvent, { type: 'model.request' }>;
export type AgentModelResponse = Extract<AgentUtilityCommand, { type: 'model.delta' | 'model.completed' | 'model.failed' | 'model.cancelled' }>;
