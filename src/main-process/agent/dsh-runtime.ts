import { randomUUID } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import { AgentRegistry, type Agent, type AgentHandle } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { LlmRuntime, LlmAdapter, type GenerateOptions, type StreamChunk, createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { AgentUtilityCommandSchema, type AgentModelResponse, type AgentUtilityEvent } from '../../shared/schemas/agent-protocol';

export interface UtilityMessagePort {
  postMessage(message: AgentUtilityEvent): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown;
  start?(): void;
}

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
 * The stage-A DSH composition used in Electron's Utility Process.
 * Domain tools are added only when they can reuse an existing validated product service.
 */
export class DshRuntime {
  private readonly ctx = new Context();
  private readonly agents = new Map<string, AgentHandle>();
  private readonly modelRequests = new Map<string, { queue: AsyncQueue<StreamChunk>; text: string; abort: () => void }>();
  private readonly assistantMessageIds = new Map<string, string>();
  private started = false;

  constructor(private readonly port: UtilityMessagePort) {}

  async start(): Promise<void> {
    if (this.started) return;
    await this.ctx.plugin(LlmRuntime);
    await this.ctx.plugin(SessionStore);
    await this.ctx.plugin(SystemPrompt, { persona: '你是知己的对话助手。通过已注册的知己能力帮助用户完成目标；当前只提供会话能力，后续能力必须复用知己既有的校验与确认流程。' });
    await this.ctx.plugin(ToolRuntime, {});
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
    const onAbort = () => {
      this.post({ type: 'model.cancel', requestId });
      queue.push({ type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: '请求已取消。' } } });
      queue.close();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    this.modelRequests.set(requestId, { queue, text: '', abort: () => controller.abort() });
    this.post({
      type: 'model.request',
      requestId,
      sessionId: String(options.sessionId ?? ''),
      messages: options.messages.flatMap((message) => {
        if (message.role !== 'user' && message.role !== 'assistant') return [];
        const content = message.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
        return content ? [{ role: message.role, content }] : [];
      }),
      ...(options.system ? { system: options.system } : {}),
    });
    try {
      yield { type: 'block-start', index: 0, blockType: 'text' };
      for await (const chunk of queue) {
        if (chunk.type === 'text-delta') output += chunk.text;
        yield chunk;
      }
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
    if (value.type === 'model.delta' || value.type === 'model.completed' || value.type === 'model.failed' || value.type === 'model.cancelled') {
      this.resolveModel(value);
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
}

function toChineseRuntimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('不存在')) return message;
  if (message.includes('取消')) return '已停止本次 Agent 请求。';
  return '知己 Agent 运行失败；请重试，其他页面不受影响。';
}
