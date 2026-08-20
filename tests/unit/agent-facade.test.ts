import { describe, expect, it, vi } from 'vitest';
import { AgentFacade, type AgentRuntimePort } from '../../src/main-process/agent/agent-facade';
import type { AgentModelTransport } from '../../src/main-process/agent/agent-model-transport';
import type { AgentModelResponse, AgentUtilityCommand, AgentUtilityEvent } from '../../src/shared/schemas/agent-protocol';

class FakeDshRuntime implements AgentRuntimePort {
  readonly commands: AgentUtilityCommand[] = [];
  private readonly events = new Set<(event: AgentUtilityEvent) => void>();
  private readonly exits = new Set<() => void>();
  start = vi.fn(async () => undefined);
  async request(command: Exclude<AgentUtilityCommand, { type: 'model.delta' | 'model.completed' | 'model.failed' | 'model.cancelled' }>): Promise<void> { this.commands.push(command); }
  send(command: AgentModelResponse): void { this.commands.push(command); }
  onEvent(listener: (event: AgentUtilityEvent) => void): () => void { this.events.add(listener); return () => this.events.delete(listener); }
  onExit(listener: () => void): () => void { this.exits.add(listener); return () => this.exits.delete(listener); }
  stop = vi.fn(async () => undefined);
  emit(event: AgentUtilityEvent): void { for (const listener of this.events) listener(event); }
  crash(): void { for (const listener of this.exits) listener(); }
}

describe('AgentFacade', () => {
  it('covers start, two streamed turns, cancellation, shutdown and a utility crash', async () => {
    const runtime = new FakeDshRuntime();
    const model = { stream: vi.fn(), cancel: vi.fn(), dispose: vi.fn() } as unknown as AgentModelTransport;
    const facade = new AgentFacade(runtime, model);
    const events: AgentUtilityEvent[] = [];
    facade.subscribe((event) => { if (event.type === 'message.delta') events.push(event); });
    const session = await facade.start('周复盘');
    await facade.send(session.id, '先帮我梳理本周');
    const firstId = crypto.randomUUID();
    runtime.emit({ type: 'message.delta', sessionId: session.id, messageId: firstId, delta: '好的，' });
    runtime.emit({ type: 'message.completed', sessionId: session.id, message: { id: firstId, role: 'assistant', content: '好的，我会先梳理本周。', at: new Date().toISOString() } });
    await facade.send(session.id, '再告诉我下一步');
    const secondId = crypto.randomUUID();
    runtime.emit({ type: 'message.delta', sessionId: session.id, messageId: secondId, delta: '下一步是' });
    runtime.emit({ type: 'message.completed', sessionId: session.id, message: { id: secondId, role: 'assistant', content: '下一步是确认材料范围。', at: new Date().toISOString() } });
    await facade.cancel(session.id);

    expect(runtime.start).toHaveBeenCalledOnce();
    expect(runtime.commands.map((item) => item.type)).toEqual(['session.start', 'session.send', 'session.send', 'session.cancel']);
    expect(events).toHaveLength(2);
    expect(facade.get(session.id).messages.map((item) => item.role)).toEqual(['user', 'assistant', 'user', 'assistant']);

    runtime.emit({ type: 'session.status', sessionId: session.id, status: 'running' });
    runtime.crash();
    expect(facade.get(session.id).status).toBe('failed');
    await facade.dispose();
    expect(runtime.stop).toHaveBeenCalledOnce();
  });
});
