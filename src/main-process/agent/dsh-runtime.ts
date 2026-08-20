import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry, type Agent, type AgentHandle } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { LlmRuntime, LlmAdapter, type GenerateOptions, type StreamChunk, createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { AgentUtilityCommandSchema, type AgentModelRequest, type AgentModelResponse, type AgentUtilityEvent } from '../../shared/schemas/agent-protocol';
import type { AgentToolResult } from '../../shared/schemas/agent-tools';

export interface UtilityMessagePort {
  postMessage(message: AgentUtilityEvent): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown;
  start?(): void;
}

const ToolOutputSchema = { type: 'object' as const, additionalProperties: true };
const TOOL_DEFINITIONS: Array<{ name: string; action: string; label: string; description: string; parameters: Record<string, unknown> }> = [
  { name: 'zhiji.journals.list', action: 'journals.list', label: '读取日志摘要', description: '读取经过脱敏的日志摘要，可按日期或项目筛选。', parameters: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, projectId: { type: 'string' } }, additionalProperties: false } },
  { name: 'zhiji.journals.get', action: 'journals.get', label: '读取日志摘要', description: '按日志 ID 读取经过脱敏的摘要。', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
  { name: 'zhiji.reviews.list', action: 'reviews.list', label: '读取复盘摘要', description: '读取已有复盘的摘要列表。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'zhiji.reviews.get', action: 'reviews.get', label: '读取复盘摘要', description: '按复盘 ID 读取经过脱敏的摘要。', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
  { name: 'zhiji.projects.list', action: 'projects.list', label: '读取项目列表', description: '读取项目名称、状态和 ID。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'zhiji.topics.list', action: 'topics.list', label: '读取已确认主题', description: '读取已确认主题的索引摘要。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'zhiji.topics.get', action: 'topics.get', label: '读取主题摘要', description: '读取一个已确认主题的经过脱敏的摘要。', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'], additionalProperties: false } },
  { name: 'zhiji.patterns.list', action: 'patterns.list', label: '读取已验证模式', description: '读取用户已确认的验证模式。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'zhiji.web.search', action: 'web.search', label: '搜索公开来源', description: '通过受控搜索查找公开来源；结果只提供本次会话的 sourceId。', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } },
  { name: 'zhiji.web.read-source', action: 'web.read-source', label: '读取搜索来源', description: '只读取同一搜索会话返回的 sourceId 对应来源。', parameters: { type: 'object', properties: { searchSessionId: { type: 'string' }, sourceId: { type: 'string' } }, required: ['searchSessionId', 'sourceId'], additionalProperties: false } },
  { name: 'zhiji.journals.create', action: 'journals.create', label: '保存日志', description: '在用户明确要求记录时，通过知己正式日志服务保存一条日志。', parameters: { type: 'object', properties: { date: { type: 'string' }, body: { type: 'string' }, projectIds: { type: 'array', items: { type: 'string' } } }, required: ['date', 'body'], additionalProperties: false } },
  { name: 'zhiji.journals.update', action: 'journals.update', label: '更新日志', description: '在用户明确要求修改时，通过知己正式日志服务按乐观并发更新日志。', parameters: { type: 'object', properties: { id: { type: 'string' }, date: { type: 'string' }, body: { type: 'string' }, projectIds: { type: 'array', items: { type: 'string' } }, expectedUpdatedAt: { type: 'string' } }, required: ['id', 'date', 'body', 'expectedUpdatedAt'], additionalProperties: false } },
  { name: 'zhiji.reviews.generate-daily', action: 'reviews.generate-daily', label: '生成每日反馈', description: '调用知己既有每日反馈服务；证据不足时只返回补证问题，不写入残缺反馈。', parameters: { type: 'object', properties: { date: { type: 'string' }, regenerate: { type: 'boolean' } }, required: ['date'], additionalProperties: false } },
  { name: 'zhiji.reviews.preview-periodic', action: 'reviews.preview-periodic', label: '预览周期复盘材料', description: '预览周/月/项目复盘材料；必须等待用户在知己 Agent 页面确认后才能生成。', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['weekly', 'monthly', 'project'] }, start: { type: 'string' }, end: { type: 'string' }, projectId: { type: 'string' } }, required: ['type', 'start', 'end'], additionalProperties: false } },
  { name: 'zhiji.reviews.generate-periodic', action: 'reviews.generate-periodic', label: '生成周期复盘', description: '仅使用预览返回的 previewToken 和用户确认返回的 approvalId 生成正式周/月/项目复盘。', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['weekly', 'monthly', 'project'] }, start: { type: 'string' }, end: { type: 'string' }, projectId: { type: 'string' }, previewToken: { type: 'string' }, approvalId: { type: 'string' } }, required: ['type', 'start', 'end', 'previewToken', 'approvalId'], additionalProperties: false } },
  { name: 'zhiji.reviews.preview-insight', action: 'reviews.preview-insight', label: '预览洞察材料', description: '预览日志质量检查、年度回顾或方向校准材料；必须等待用户在知己 Agent 页面确认后才能生成。', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['coach', 'yearly', 'life-design'] }, start: { type: 'string' }, end: { type: 'string' }, topic: { type: 'string' } }, required: ['type', 'start', 'end'], additionalProperties: false } },
  { name: 'zhiji.reviews.generate-insight', action: 'reviews.generate-insight', label: '生成洞察复盘', description: '仅使用预览返回的 previewToken 和用户确认返回的 approvalId 生成正式洞察复盘。', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['coach', 'yearly', 'life-design'] }, start: { type: 'string' }, end: { type: 'string' }, topic: { type: 'string' }, previewToken: { type: 'string' }, approvalId: { type: 'string' } }, required: ['type', 'start', 'end', 'previewToken', 'approvalId'], additionalProperties: false } },
  { name: 'zhiji.ui.navigate', action: 'ui.navigate', label: '打开产品页面', description: '请求打开一个经过验证的知己产品页面。', parameters: { type: 'object', properties: { target: { type: 'object' } }, required: ['target'], additionalProperties: false } },
  { name: 'zhiji.ui.present', action: 'ui.present', label: '展示结果卡片', description: '请求展示含受控产品页链接的结果卡片。', parameters: { type: 'object', properties: { title: { type: 'string' }, summary: { type: 'string' }, links: { type: 'array' } }, required: ['title', 'summary', 'links'], additionalProperties: false } },
];

class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<(value: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter({ done: false, value });
    else if (!this.closed) this.values.push(value);
  }

  close(): void {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter({ done: true, value: undefined });
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (;;) {
      const value = this.values.shift();
      if (value !== undefined) { yield value; continue; }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve));
      if (next.done) return;
      yield next.value;
    }
  }
}

class MainProcessModelAdapter extends LlmAdapter {
  constructor(private readonly runtime: DshRuntime) { super(); }
  stream(options: GenerateOptions): AsyncIterable<StreamChunk> { return this.runtime.streamModel(options); }
}

/**
 * The DSH composition used in Electron's Utility Process.
 * Domain tools are added only when they reuse an existing validated product service.
 */
export class DshRuntime {
  private readonly ctx = new Context();
  private readonly agents = new Map<string, AgentHandle>();
  private readonly modelRequests = new Map<string, { queue: AsyncQueue<StreamChunk>; text: string; abort: () => void }>();
  private readonly toolRequests = new Map<string, { resolve: (result: AgentToolResult) => void; reject: (error: Error) => void }>();
  private readonly assistantMessageIds = new Map<string, string>();
  private started = false;

  constructor(private readonly port: UtilityMessagePort) {}

  async start(): Promise<void> {
    if (this.started) return;
    await this.ctx.plugin(LlmRuntime);
    await this.ctx.plugin(SessionStore);
    await this.ctx.plugin(SystemPrompt, { persona: '你是知己的对话助手。通过已注册的知己能力帮助用户完成目标；可读取经脱敏的日志、复盘、项目、主题和验证模式，也可在用户明确要求时保存或更新日志、生成每日反馈。周/月/项目复盘和洞察复盘必须先预览材料，再等待用户点击知己 Agent 页面中的确认按钮；不要把自己的判断或普通聊天中的“确认”当成用户确认。不要声称已写入或生成正式内容，除非对应工具返回成功；正式内容始终由知己既有校验、证据降级和保存服务负责。' });
    await this.ctx.plugin(ToolRuntime, {});
    for (const definition of TOOL_DEFINITIONS) this.ctx.tools.register(this.createTool(definition));
    await this.ctx.plugin(AgentRegistry);
    this.ctx.llm.registerAdapter(['zhiji'], new MainProcessModelAdapter(this));
    await this.ctx.plugin(AgentLoop, { agents: [] });
    this.ctx.on('session/event', (session, event) => this.handleSessionEvent(String(session.id), event));
    this.ctx.on('agent/status', ({ agent, status }) => this.post({ type: 'session.status', sessionId: String(agent.id), status }));
    this.ctx.on('agent/error', ({ agent, error }) => this.post({ type: 'runtime.error', sessionId: String(agent.id), message: toChineseRuntimeError(error) }));
    this.port.on('message', (event) => { void this.handleCommand(event.data); });
    this.port.start?.();
    this.started = true;
    this.post({ type: 'runtime.ready' });
  }

  async dispose(): Promise<void> {
    for (const request of this.modelRequests.values()) request.abort();
    this.modelRequests.clear();
    for (const request of this.toolRequests.values()) request.reject(new Error('知己工具连接已停止。'));
    this.toolRequests.clear();
    for (const handle of this.agents.values()) await handle.dispose();
    this.agents.clear();
    await this.ctx.fiber.dispose();
    this.started = false;
    this.post({ type: 'runtime.stopped' });
  }

  async *streamModel(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const requestId = randomUUID();
    const queue = new AsyncQueue<StreamChunk>();
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    let output = '';
    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
    const onAbort = () => {
      this.post({ type: 'model.cancel', requestId });
      queue.push({ type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: '请求已取消。' } } });
      queue.close();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    this.modelRequests.set(requestId, { queue, text: '', abort: () => controller.abort() });
    const messages: AgentModelRequest['messages'] = [];
    for (const message of options.messages) {
      const text = message.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
      const calls = message.content.filter((block) => block.type === 'tool-call').map((block) => ({ id: String(block.id), name: block.name, arguments: block.arguments }));
      const result = message.content.find((block) => block.type === 'tool-result');
      if (result?.type === 'tool-result') messages.push({ role: 'tool', toolCallId: String(result.toolCallId), content: result.content.filter((block) => block.type === 'text').map((block) => block.text).join('') });
      else if (message.role === 'assistant' && (text || calls.length)) messages.push({ role: 'assistant', content: text, ...(calls.length ? { toolCalls: calls } : {}) });
      else if ((message.role === 'user' || message.role === 'system') && text) messages.push({ role: message.role, content: text });
    }
    this.post({
      type: 'model.request',
      requestId,
      sessionId: String(options.sessionId ?? ''),
      messages,
      ...(options.system ? { system: options.system } : {}),
      ...(options.tools?.length ? { tools: options.tools.map(({ name, description, parameters }) => ({ name, description, parameters })) } : {}),
    });
    try {
      yield { type: 'block-start', index: 0, blockType: 'text' };
      for await (const chunk of queue) {
        if (chunk.type === 'text-delta') output += chunk.text;
        if (chunk.type === 'tool-call-delta') {
          const current = toolCalls.get(chunk.index) ?? { id: String(chunk.id), name: '', arguments: '' };
          if (chunk.name) current.name = chunk.name;
          current.arguments += chunk.argumentsDelta;
          toolCalls.set(chunk.index, current);
          if (current.arguments === chunk.argumentsDelta) yield { type: 'block-start', index: chunk.index, blockType: 'tool-call' };
        }
        yield chunk;
      }
      for (const [index, tool] of toolCalls) yield { type: 'block-end', index, block: { type: 'tool-call', id: tool.id as never, name: tool.name, arguments: tool.arguments } };
      if (output) yield { type: 'block-end', index: 0, block: { type: 'text', text: output } };
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.modelRequests.delete(requestId);
    }
  }

  private async handleCommand(raw: unknown): Promise<void> {
    const command = AgentUtilityCommandSchema.safeParse(raw);
    if (!command.success) return;
    const value = command.data;
    if (value.type === 'model.delta' || value.type === 'model.tool-call' || value.type === 'model.completed' || value.type === 'model.failed' || value.type === 'model.cancelled') {
      this.resolveModel(value);
      return;
    }
    if (value.type === 'tool.result') {
      this.toolRequests.get(value.requestId)?.resolve(value.result);
      this.toolRequests.delete(value.requestId);
      return;
    }
    try {
      if (value.type === 'session.start') {
        const handle = await this.ctx.agents.create({ sessionId: SessionId(value.sessionId), agentOptions: { provider: 'zhiji', model: 'configured-by-main-process' } });
        this.agents.set(value.sessionId, handle);
      } else if (value.type === 'session.send') {
        const agent = this.getAgent(value.sessionId);
        agent.followup(createUserMessage({ content: [{ type: 'text', text: value.message }], source: { kind: 'user' } }));
      } else if (value.type === 'session.cancel') {
        this.getAgent(value.sessionId).cancel({ kind: 'user' });
      } else if (value.type === 'runtime.shutdown') {
        await this.dispose();
      }
      this.post({ type: 'command.completed', requestId: value.requestId });
    } catch (error) {
      this.post({ type: 'command.failed', requestId: value.requestId, message: toChineseRuntimeError(error) });
    }
  }

  private resolveModel(command: AgentModelResponse): void {
    const request = this.modelRequests.get(command.requestId);
    if (!request) return;
    if (command.type === 'model.delta') request.queue.push({ type: 'text-delta', index: 0, text: command.delta });
    if (command.type === 'model.tool-call') request.queue.push({ type: 'tool-call-delta', index: command.index, id: command.callId as never, ...(command.name ? { name: command.name } : {}), argumentsDelta: command.argumentsDelta });
    if (command.type === 'model.completed') { request.queue.push({ type: 'finish', reason: { kind: 'stop' } }); request.queue.close(); }
    if (command.type === 'model.cancelled') { request.queue.push({ type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: '请求已取消。' } } }); request.queue.close(); }
    if (command.type === 'model.failed') { request.queue.push({ type: 'finish', reason: { kind: 'error', failure: { code: 'HOST_MODEL_FAILED', message: command.message } } }); request.queue.close(); }
  }

  private handleSessionEvent(sessionId: string, event: SessionEvent): void {
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'text-delta') {
      const key = `${sessionId}:${event.data.turn}`;
      const messageId = this.assistantMessageIds.get(key) ?? randomUUID();
      this.assistantMessageIds.set(key, messageId);
      this.post({ type: 'message.delta', sessionId, messageId, delta: event.data.chunk.text });
      return;
    }
    if (event.type === 'assistant/message') {
      const content = event.data.message.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
      if (!content) return;
      const key = `${sessionId}:${event.data.turn}`;
      const messageId = this.assistantMessageIds.get(key) ?? randomUUID();
      this.assistantMessageIds.delete(key);
      this.post({ type: 'message.completed', sessionId, message: { id: messageId, role: 'assistant', content, at: new Date().toISOString() } });
    }
  }

  private getAgent(sessionId: string): Agent {
    const handle = this.agents.get(sessionId);
    if (!handle) throw new Error('Agent 会话不存在。');
    return handle.agent;
  }

  private post(event: AgentUtilityEvent): void { this.port.postMessage(event); }

  private createTool(definition: typeof TOOL_DEFINITIONS[number]): ToolDefinition {
    return {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      output: { schema: ToolOutputSchema, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: (args, exec) => this.callTool(String(exec.agent?.id ?? ''), definition.action, args, exec, definition.label),
    };
  }

  private async callTool(sessionId: string, action: string, input: unknown, exec: ToolRunContext, label: string): Promise<AgentToolResult> {
    if (!sessionId) throw new Error('知己工具未关联到有效会话。');
    if (exec.signal.aborted) throw new Error('已停止本次工具调用。');
    const requestId = randomUUID();
    this.post({ type: 'tool.activity', sessionId, callId: requestId, phase: 'started', label });
    const result = await new Promise<AgentToolResult>((resolve, reject) => {
      const abort = () => { this.post({ type: 'tool.cancel', sessionId, requestId }); this.toolRequests.delete(requestId); reject(new Error('已停止本次工具调用。')); };
      exec.signal.addEventListener('abort', abort, { once: true });
      this.toolRequests.set(requestId, {
        resolve: (value) => { exec.signal.removeEventListener('abort', abort); resolve(value); },
        reject: (error) => { exec.signal.removeEventListener('abort', abort); reject(error); },
      });
      this.post({ type: 'tool.request', requestId, sessionId, action: action as never, input: input as never });
    });
    if (result.kind === 'error') {
      this.post({ type: 'tool.activity', sessionId, callId: requestId, phase: 'failed', label });
      throw new Error(result.message);
    }
    this.post({ type: 'tool.activity', sessionId, callId: requestId, phase: 'completed', label });
    if (result.kind === 'ui.navigate') this.post({ type: 'ui.navigate', sessionId, target: result.target });
    if (result.kind === 'ui.present') this.post({ type: 'ui.present', sessionId, card: result.card });
    return result;
  }
}

function toChineseRuntimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('不存在')) return message;
  if (message.includes('取消')) return '已停止本次 Agent 请求。';
  return '知己 Agent 运行失败；请重试，其他页面不受影响。';
}
