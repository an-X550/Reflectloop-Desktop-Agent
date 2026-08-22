import { describe, expect, it } from 'vitest';
import { AgentConfirmInputSchema, AgentSendInputSchema, AgentStartInputSchema } from '../../src/shared/schemas/ipc';
import { AgentEventSchema } from '../../src/shared/schemas/agent';
import { AgentToolBridgeRequestSchema } from '../../src/shared/schemas/agent-tools';

describe('Agent IPC schemas', () => {
  it('accepts bounded session input and rejects a path-shaped session id', () => {
    expect(AgentStartInputSchema.parse({ title: '本周复盘' })).toEqual({ title: '本周复盘' });
    expect(AgentSendInputSchema.parse({ sessionId: 'agent_abc123', message: '继续' })).toEqual({ sessionId: 'agent_abc123', message: '继续' });
    expect(() => AgentSendInputSchema.parse({ sessionId: 'C:\\data\\session', message: '继续' })).toThrow();
  });

  it('accepts only a bounded approval id tied to an Agent session', () => {
    expect(AgentConfirmInputSchema.parse({ sessionId: 'agent_abc123', approvalId: 'approval_abc123' })).toEqual({ sessionId: 'agent_abc123', approvalId: 'approval_abc123' });
    expect(() => AgentConfirmInputSchema.parse({ sessionId: 'agent_abc123', approvalId: 'https://attacker.example' })).toThrow();
  });

  it('accepts bounded memory evidence events and rejects unsafe or unknown fields', () => {
    const event = {
      type: 'tool.evidence' as const,
      sessionId: 'agent_abc123',
      callId: crypto.randomUUID(),
      source: 'memory.search' as const,
      hits: [{ id: 'journal_a1', kind: 'journal' as const, date: '2026-08-20', excerpt: '真实日志摘录' }],
    };

    expect(AgentEventSchema.parse(event)).toEqual(event);
    expect(AgentEventSchema.safeParse({ ...event, unexpected: true }).success).toBe(false);
    expect(AgentEventSchema.safeParse({ ...event, hits: [{ ...event.hits[0], excerpt: 'x'.repeat(801) }] }).success).toBe(false);
  });

  it('trims and de-duplicates alternate memory queries while rejecting invalid input', () => {
    const base = { type: 'tool.request' as const, requestId: crypto.randomUUID(), sessionId: 'agent_abc123', action: 'memory.search' as const };
    const parsed = AgentToolBridgeRequestSchema.parse({ ...base, input: { query: '任务', alternates: [' 行动 ', '行动'], limit: 3 } });

    expect(parsed.input).toEqual({ query: '任务', alternates: ['行动'], limit: 3 });
    expect(AgentToolBridgeRequestSchema.safeParse({ ...base, input: { query: '任务', alternates: ['', '行动'] } }).success).toBe(false);
    expect(AgentToolBridgeRequestSchema.safeParse({ ...base, input: { query: '任务', alternates: ['一', '二', '三', '四'] } }).success).toBe(false);
    expect(AgentToolBridgeRequestSchema.safeParse({ ...base, input: { query: '任务', alternates: ['x'.repeat(81)] } }).success).toBe(false);
  });
});
