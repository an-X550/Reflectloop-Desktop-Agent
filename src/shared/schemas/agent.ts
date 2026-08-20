import { z } from 'zod';
import { AgentNavigationTargetSchema, AgentPresentationCardSchema } from './agent-tools';

export const AgentSessionIdSchema = z.string().regex(/^agent_[a-z0-9]+$/);
export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000),
  at: z.iso.datetime({ offset: true }),
}).strict();

export const AgentSessionSchema = z.object({
  id: AgentSessionIdSchema,
  title: z.string().trim().min(1).max(80),
  status: z.enum(['idle', 'running', 'failed']),
  messages: z.array(AgentMessageSchema).max(200),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict();

export const AgentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.updated'), session: AgentSessionSchema }).strict(),
  z.object({ type: z.literal('message.delta'), sessionId: AgentSessionIdSchema, messageId: z.string().uuid(), delta: z.string().min(1).max(20_000) }).strict(),
  z.object({ type: z.literal('message.completed'), sessionId: AgentSessionIdSchema, message: AgentMessageSchema }).strict(),
  z.object({ type: z.literal('tool.activity'), sessionId: AgentSessionIdSchema, callId: z.string().trim().min(1).max(200), phase: z.enum(['started', 'completed', 'failed']), label: z.string().trim().min(1).max(120) }).strict(),
  z.object({ type: z.literal('ui.navigate'), sessionId: AgentSessionIdSchema, target: AgentNavigationTargetSchema }).strict(),
  z.object({ type: z.literal('ui.present'), sessionId: AgentSessionIdSchema, card: AgentPresentationCardSchema }).strict(),
  z.object({ type: z.literal('error'), sessionId: AgentSessionIdSchema.optional(), message: z.string().trim().min(1).max(500) }).strict(),
]);

export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type AgentSession = z.infer<typeof AgentSessionSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
