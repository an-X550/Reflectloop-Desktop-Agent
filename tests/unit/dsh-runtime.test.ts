import { afterEach, describe, expect, it } from 'vitest';
import { DshRuntime, type UtilityMessagePort } from '../../src/main-process/agent/dsh-runtime';
import type { AgentUtilityCommand, AgentUtilityEvent } from '../../src/shared/schemas/agent-protocol';

class FakePort implements UtilityMessagePort {
  readonly sent: AgentUtilityEvent[] = [];
  private listener: ((event: { data: unknown }) => void) | undefined;
  postMessage(message: AgentUtilityEvent): void { this.sent.push(message); }
  on(_event: 'message', listener: (event: { data: unknown }) => void): void { this.listener = listener; }
  start(): void { return undefined; }
  receive(command: AgentUtilityCommand): void { this.listener?.({ data: command }); }
  async next<T extends AgentUtilityEvent['type']>(type: T): Promise<Extract<AgentUtilityEvent, { type: T }>> {
    for (let attempts = 0; attempts < 100; attempts += 1) {
      const found = this.sent.find((event) => event.type === type);
      if (found) return found as Extract<AgentUtilityEvent, { type: T }>;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`没有收到 ${type}`);
  }
}

describe('DshRuntime', () => {
  let runtime: DshRuntime | undefined;
  afterEach(async () => { await runtime?.dispose(); runtime = undefined; });

  it('runs a real DSH agent loop through the fake model relay without any product tool', async () => {
    const port = new FakePort();
    runtime = new DshRuntime(port);
    await runtime.start();
    expect(await port.next('runtime.ready')).toEqual({ type: 'runtime.ready' });
    const sessionId = 'agent_dshloop';
    port.receive({ type: 'session.start', requestId: crypto.randomUUID(), sessionId });
    await port.next('command.completed');
    port.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '请用一句话回应' });
    const request = await port.next('model.request');
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: '请用一句话回应' });
    port.receive({ type: 'model.delta', requestId: request.requestId, delta: '这是来自假模型的回复。' });
    port.receive({ type: 'model.completed', requestId: request.requestId });
    const completed = await port.next('message.completed');
    expect(completed.message.content).toBe('这是来自假模型的回复。');
    port.receive({ type: 'session.cancel', requestId: crypto.randomUUID(), sessionId });
    await port.next('command.completed');
  });
});
