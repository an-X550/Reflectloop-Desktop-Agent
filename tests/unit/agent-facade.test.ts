import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AgentFacade, type AgentRuntimePort } from '../../src/main-process/agent/agent-facade';
import type { AgentModelTransport } from '../../src/main-process/agent/agent-model-transport';
import type { AgentModelResponse, AgentUtilityCommand, AgentUtilityEvent } from '../../src/shared/schemas/agent-protocol';
import type { AgentEvent } from '../../src/shared/schemas/agent';

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

  it('resumes a pending workflow only after the Main Process approval is accepted', async () => {
    const runtime = new FakeDshRuntime();
    const model = { stream: vi.fn(), cancel: vi.fn(), dispose: vi.fn() } as unknown as AgentModelTransport;
    const dispatcher = { approve: vi.fn(() => true), dispatch: vi.fn() };
    const facade = new AgentFacade(runtime, model, dispatcher as never);
    const session = await facade.start('生成周复盘');
    await facade.confirm(session.id, 'approval_abc123');

    expect(dispatcher.approve).toHaveBeenCalledWith(session.id, 'approval_abc123');
    expect(runtime.commands.map((item) => item.type)).toEqual(['session.start', 'session.send']);
    expect(facade.get(session.id).messages.at(-1)?.content).toContain('确认执行');
  });

  it('emits only non-empty memory evidence from the Main Process validated result', async () => {
    const runtime = new FakeDshRuntime();
    const model = { stream: vi.fn(), cancel: vi.fn(), dispose: vi.fn() } as unknown as AgentModelTransport;
    const dispatcher = {
      approve: vi.fn(() => true),
      dispatch: vi.fn()
        .mockResolvedValueOnce({ kind: 'memory.search', hits: [] })
        .mockResolvedValueOnce({ kind: 'memory.search', hits: [{ id: 'journal_a1', kind: 'journal', date: '2026-08-20', excerpt: '真实日志摘录' }] }),
    };
    const facade = new AgentFacade(runtime, model, dispatcher as never);
    const events: AgentEvent[] = [];
    facade.subscribe((event) => events.push(event));
    const session = await facade.start('检索历史');
    const requestEvent = (requestId: string): AgentUtilityEvent => ({ type: 'tool.request', requestId, sessionId: session.id, action: 'memory.search', input: { query: '行动' } });

    runtime.emit(requestEvent(crypto.randomUUID()));
    await new Promise((resolve) => setTimeout(resolve, 0));
    runtime.emit(requestEvent(crypto.randomUUID()));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events.filter((event) => event.type === 'tool.evidence')).toEqual([expect.objectContaining({ type: 'tool.evidence', sessionId: session.id, source: 'memory.search', hits: [{ id: 'journal_a1', kind: 'journal', date: '2026-08-20', excerpt: '真实日志摘录' }] })]);
    await facade.dispose();
  });

  it('deletes an idle session through the runtime and removes it from the facade', async () => {
    const runtime = new FakeDshRuntime();
    const model = { stream: vi.fn(), cancel: vi.fn(), dispose: vi.fn() } as unknown as AgentModelTransport;
    const sessionRoot = await mkdtemp(path.join(os.tmpdir(), 'zhiji-agent-delete-'));
    const trashItem = vi.fn(async () => undefined);
    const facade = new AgentFacade(runtime, model, undefined, { sessionRoot, trashItem });
    const session = await facade.start('待删除');
    const sessionPath = path.join(sessionRoot, '_no-cwd', session.id);
    await mkdir(sessionPath, { recursive: true });
    await facade.delete(session.id);

    expect(runtime.commands.map((item) => item.type)).toEqual(['session.start', 'session.delete']);
    expect(trashItem).toHaveBeenCalledWith(sessionPath);
    expect(() => facade.get(session.id)).toThrow();
    await facade.dispose();
    await rm(sessionRoot, { recursive: true, force: true });
  });

  it('loads persisted DSH session snapshots through the normal Agent list call', async () => {
    const runtime = new FakeDshRuntime();
    const model = { stream: vi.fn(), cancel: vi.fn(), dispose: vi.fn() } as unknown as AgentModelTransport;
    const facade = new AgentFacade(runtime, model);
    const listPromise = facade.list();
    await Promise.resolve();
    runtime.emit({ type: 'session.snapshot', session: { id: 'agent_recovered', title: '恢复的对话', status: 'idle', messages: [{ id: crypto.randomUUID(), role: 'user', content: '继续', at: new Date().toISOString() }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    expect(await listPromise).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'agent_recovered', title: '恢复的对话' })]));
    expect(runtime.commands.map((item) => item.type)).toEqual(['session.list']);
    await facade.dispose();
  });
});
