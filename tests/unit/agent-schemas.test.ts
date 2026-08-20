import { describe, expect, it } from 'vitest';
import { AgentSendInputSchema, AgentStartInputSchema } from '../../src/shared/schemas/ipc';

describe('Agent IPC schemas', () => {
  it('accepts bounded session input and rejects a path-shaped session id', () => {
    expect(AgentStartInputSchema.parse({ title: '本周复盘' })).toEqual({ title: '本周复盘' });
    expect(AgentSendInputSchema.parse({ sessionId: 'agent_abc123', message: '继续' })).toEqual({ sessionId: 'agent_abc123', message: '继续' });
    expect(() => AgentSendInputSchema.parse({ sessionId: 'C:\\data\\session', message: '继续' })).toThrow();
  });
});
