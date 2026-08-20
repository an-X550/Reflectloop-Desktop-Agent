import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DshRuntime, type UtilityMessagePort } from '../../src/main-process/agent/dsh-runtime';
import type { AgentRuntimeResponse, AgentUtilityCommand, AgentUtilityEvent } from '../../src/shared/schemas/agent-protocol';

class FakePort implements UtilityMessagePort {
  readonly sent: AgentUtilityEvent[] = [];
  private listener: ((event: { data: unknown }) => void) | undefined;
  postMessage(message: AgentUtilityEvent): void { this.sent.push(message); }
  on(_event: 'message', listener: (event: { data: unknown }) => void): void { this.listener = listener; }
  start(): void { return undefined; }
  receive(command: AgentUtilityCommand | AgentRuntimeResponse): void { this.listener?.({ data: command }); }
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
  let sessionRoot: string | undefined;
  afterEach(async () => { await runtime?.dispose(); runtime = undefined; if (sessionRoot) await rm(sessionRoot, { recursive: true, force: true }); sessionRoot = undefined; });

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

  it('runs one real Agent turn across journals and reviews through the strict tool bridge', async () => {
    const port = new FakePort();
    runtime = new DshRuntime(port);
    await runtime.start();
    const sessionId = 'agent_twodomains';
    port.receive({ type: 'session.start', requestId: crypto.randomUUID(), sessionId });
    await port.next('command.completed');
    port.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '结合日志和复盘给我一个建议' });
    const firstRequest = await port.next('model.request');
    expect(firstRequest.tools?.map((tool) => tool.name)).toContain('zhiji.journals.list');
    expect(firstRequest.tools?.map((tool) => tool.name)).toContain('zhiji.reviews.list');
    expect(firstRequest.system).toContain('必须先预览材料，再等待用户点击知己 Agent 页面中的确认按钮');

    port.receive({ type: 'model.tool-call', requestId: firstRequest.requestId, index: 1, callId: 'call_journals', name: 'zhiji.journals.list', argumentsDelta: '{}' });
    port.receive({ type: 'model.tool-call', requestId: firstRequest.requestId, index: 2, callId: 'call_reviews', name: 'zhiji.reviews.list', argumentsDelta: '{}' });
    port.receive({ type: 'model.completed', requestId: firstRequest.requestId });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.request').length < 1; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const firstToolRequest = port.sent.find((event): event is Extract<AgentUtilityEvent, { type: 'tool.request' }> => event.type === 'tool.request');
    if (!firstToolRequest) throw new Error('没有收到日志工具请求');
    expect(firstToolRequest.action).toBe('journals.list');
    port.receive({ type: 'tool.result', requestId: firstToolRequest.requestId, result: { kind: 'journals.list', journals: [] } });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.request').length < 2; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const requests = port.sent.filter((event): event is Extract<AgentUtilityEvent, { type: 'tool.request' }> => event.type === 'tool.request');
    expect(requests.map((event) => event.action)).toEqual(['journals.list', 'reviews.list']);
    port.receive({ type: 'tool.result', requestId: requests[1].requestId, result: { kind: 'reviews.list', reviews: [] } });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'model.request').length < 2; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const requestsToModel = port.sent.filter((event): event is Extract<AgentUtilityEvent, { type: 'model.request' }> => event.type === 'model.request');
    const secondRequest = requestsToModel[1];
    expect(secondRequest.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', toolCalls: expect.arrayContaining([expect.objectContaining({ name: 'zhiji.journals.list' }), expect.objectContaining({ name: 'zhiji.reviews.list' })]) }),
      expect.objectContaining({ role: 'tool', toolCallId: 'call_journals' }),
      expect.objectContaining({ role: 'tool', toolCallId: 'call_reviews' }),
    ]));
    port.receive({ type: 'model.delta', requestId: secondRequest.requestId, delta: '我已结合两类材料。' });
    port.receive({ type: 'model.completed', requestId: secondRequest.requestId });
    expect((await port.next('message.completed')).message.content).toBe('我已结合两类材料。');
  });

  it('persists a session, lists it after restart, and resumes its event history', async () => {
    sessionRoot = await mkdtemp(path.join(os.tmpdir(), 'zhiji-dsh-sessions-'));
    const firstPort = new FakePort();
    runtime = new DshRuntime(firstPort, { sessionRoot });
    await runtime.start();
    const sessionId = 'agent_persisted';
    firstPort.receive({ type: 'session.start', requestId: crypto.randomUUID(), sessionId });
    await firstPort.next('command.completed');
    firstPort.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '保留这段对话' });
    const firstRequest = await firstPort.next('model.request');
    firstPort.receive({ type: 'model.delta', requestId: firstRequest.requestId, delta: '已保存。' });
    firstPort.receive({ type: 'model.completed', requestId: firstRequest.requestId });
    await firstPort.next('message.completed');
    await runtime.dispose();
    runtime = undefined;

    const secondPort = new FakePort();
    runtime = new DshRuntime(secondPort, { sessionRoot });
    await runtime.start();
    secondPort.receive({ type: 'session.list', requestId: crypto.randomUUID() });
    const snapshot = await secondPort.next('session.snapshot');
    expect(snapshot.session.id).toBe(sessionId);
    expect(snapshot.session.messages.map((message) => message.content)).toEqual(['保留这段对话', '已保存。']);
    secondPort.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '继续这段对话' });
    const resumedRequest = await secondPort.next('model.request');
    expect(resumedRequest.messages.map((message) => message.content)).toContain('已保存。');
    secondPort.receive({ type: 'model.delta', requestId: resumedRequest.requestId, delta: '继续完成。' });
    secondPort.receive({ type: 'model.completed', requestId: resumedRequest.requestId });
    expect((await secondPort.next('message.completed')).message.content).toBe('继续完成。');
  });

  it('reports a damaged persisted session instead of silently resetting it', async () => {
    sessionRoot = await mkdtemp(path.join(os.tmpdir(), 'zhiji-dsh-corrupt-'));
    const sessionPath = path.join(sessionRoot, '_no-cwd', 'agent_corrupt', 'session.jsonl');
    await mkdir(path.dirname(sessionPath), { recursive: true });
    await writeFile(sessionPath, 'not-json\n', 'utf8');
    const port = new FakePort();
    runtime = new DshRuntime(port, { sessionRoot });
    await runtime.start();
    const requestId = crypto.randomUUID();
    port.receive({ type: 'session.list', requestId });
    const failed = await port.next('command.failed');
    expect(failed.requestId).toBe(requestId);
    expect(failed.message).toContain('会话数据损坏');
  });
});
