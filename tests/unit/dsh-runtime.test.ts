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
    expect(request.system).toMatch(/知己桌面端当前本地日期是 \d{4}-\d{2}-\d{2}，今天是星期[日一二三四五六]/);
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
    expect(firstRequest.tools?.map((tool) => tool.name)).toContain('zhiji.memory.search');
    const memoryTool = firstRequest.tools?.find((tool) => tool.name === 'zhiji.memory.search');
    expect(memoryTool?.description).toContain('最多 3 个 alternates');
    expect(memoryTool?.parameters).toMatchObject({ properties: { alternates: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 80 } } } });
    expect(firstRequest.system).toContain('必须先预览材料，再等待用户点击知己 Agent 页面中的确认按钮');
    expect(firstRequest.system).toContain('上下文压缩已由 DSH 官方');
    expect(firstRequest.system).toContain('没有标准 MCP Client');
    expect(firstRequest.system).toContain('当 memory.search 返回相互矛盾的日志、复盘或已验证模式时，必须明确列出冲突双方');
    expect(firstRequest.system).toContain('涉及事实是否发生、时间和用户原始表述时，以日志原文为最高依据');
    expect(firstRequest.system).toContain('复盘和已验证模式只能作为归纳，不能静默覆盖冲突日志');
    expect(firstRequest.system).toContain('若日志本身不足以裁决，明确说明无法确认，不得编造结论');

    port.receive({ type: 'model.reasoning-delta', requestId: firstRequest.requestId, delta: '先分析可用材料。' });
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
      expect.objectContaining({ role: 'assistant', reasoning: '先分析可用材料。', toolCalls: expect.arrayContaining([expect.objectContaining({ name: 'zhiji.journals.list' }), expect.objectContaining({ name: 'zhiji.reviews.list' })]) }),
      expect.objectContaining({ role: 'tool', toolCallId: 'call_journals' }),
      expect.objectContaining({ role: 'tool', toolCallId: 'call_reviews' }),
    ]));
    port.receive({ type: 'model.delta', requestId: secondRequest.requestId, delta: '我已结合两类材料。' });
    port.receive({ type: 'model.completed', requestId: secondRequest.requestId });
    expect((await port.next('message.completed')).message.content).toBe('我已结合两类材料。');
  });

  it('returns structured web errors to the model and suppresses a same-query repeat after a non-retryable failure', async () => {
    const port = new FakePort();
    runtime = new DshRuntime(port);
    await runtime.start();
    const sessionId = 'agent_weberror';
    port.receive({ type: 'session.start', requestId: crypto.randomUUID(), sessionId });
    await port.next('command.completed');
    port.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '搜索 Electron net.fetch' });
    const firstModelRequest = await port.next('model.request');
    port.receive({ type: 'model.tool-call', requestId: firstModelRequest.requestId, index: 1, callId: 'call_web_1', name: 'zhiji.web.search', argumentsDelta: '{"query":"Electron net.fetch"}' });
    port.receive({ type: 'model.completed', requestId: firstModelRequest.requestId });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.request').length < 1; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const firstTool = port.sent.find((event): event is Extract<AgentUtilityEvent, { type: 'tool.request' }> => event.type === 'tool.request' && event.action === 'web.search');
    if (!firstTool) throw new Error('没有收到搜索工具请求');
    port.receive({ type: 'tool.result', requestId: firstTool.requestId, result: { kind: 'error', code: 'SEARCH_UNAVAILABLE', message: '搜索服务暂时不可用，请稍后再试。', retryable: false } });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'model.request').length < 2; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const secondModelRequest = port.sent.filter((event): event is Extract<AgentUtilityEvent, { type: 'model.request' }> => event.type === 'model.request')[1];
    expect(secondModelRequest.messages.at(-1)?.content).toContain('SEARCH_UNAVAILABLE');

    port.receive({ type: 'model.tool-call', requestId: secondModelRequest.requestId, index: 1, callId: 'call_web_2', name: 'zhiji.web.search', argumentsDelta: '{"query":"Electron net.fetch"}' });
    port.receive({ type: 'model.completed', requestId: secondModelRequest.requestId });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'model.request').length < 3; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(port.sent.filter((event) => event.type === 'tool.request' && event.action === 'web.search')).toHaveLength(1);
    expect(port.sent.filter((event) => event.type === 'tool.activity' && event.phase === 'failed')).toHaveLength(1);
  });

  it('automatically retries one timed-out search and emits one activity outcome', async () => {
    const port = new FakePort();
    runtime = new DshRuntime(port);
    await runtime.start();
    const sessionId = 'agent_webretry';
    port.receive({ type: 'session.start', requestId: crypto.randomUUID(), sessionId });
    await port.next('command.completed');
    port.receive({ type: 'session.send', requestId: crypto.randomUUID(), sessionId, message: '搜索官方说明' });
    const modelRequest = await port.next('model.request');
    port.receive({ type: 'model.tool-call', requestId: modelRequest.requestId, index: 1, callId: 'call_retry', name: 'zhiji.web.search', argumentsDelta: '{"query":"官方说明"}' });
    port.receive({ type: 'model.completed', requestId: modelRequest.requestId });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.request').length < 1; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const firstTool = port.sent.find((event): event is Extract<AgentUtilityEvent, { type: 'tool.request' }> => event.type === 'tool.request' && event.action === 'web.search');
    if (!firstTool) throw new Error('没有收到首次搜索工具请求');
    port.receive({ type: 'tool.result', requestId: firstTool.requestId, result: { kind: 'error', code: 'SEARCH_TIMEOUT', message: '搜索公开来源响应超时，可以自动重试一次。', retryable: true } });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.request' && event.action === 'web.search').length < 2; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    const searchTools = port.sent.filter((event): event is Extract<AgentUtilityEvent, { type: 'tool.request' }> => event.type === 'tool.request' && event.action === 'web.search');
    expect(searchTools).toHaveLength(2);
    port.receive({ type: 'tool.result', requestId: searchTools[1].requestId, result: { kind: 'web.search', searchSessionId: 'search_retryok', results: [{ sourceId: 'source_retryok', title: '官方来源', domain: 'example.com', snippet: '摘要', publishedAt: null, retrievedAt: '2026-08-22T00:00:00.000Z' }] } });
    for (let attempts = 0; attempts < 100 && port.sent.filter((event) => event.type === 'tool.activity' && event.phase === 'completed').length < 1; attempts += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(port.sent.filter((event) => event.type === 'tool.activity' && event.phase === 'started')).toHaveLength(1);
    expect(port.sent.filter((event) => event.type === 'tool.activity' && event.phase === 'completed')).toHaveLength(1);
    expect(port.sent.filter((event) => event.type === 'tool.activity' && event.phase === 'failed')).toHaveLength(0);
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
