import { randomUUID } from 'node:crypto';
import { appError } from '../../shared/errors/app-error';
import type { AgentEvent, AgentMessage, AgentSession } from '../../shared/schemas/agent';
import type { AgentModelRequest, AgentRuntimeResponse, AgentUtilityCommand, AgentUtilityEvent } from '../../shared/schemas/agent-protocol';
import type { AgentModelTransport } from './agent-model-transport';
import type { AgentToolDispatcher } from './agent-tool-dispatcher';

export interface AgentRuntimePort {
  start(): Promise<void>;
  request(command: Exclude<AgentUtilityCommand, { type: 'model.delta' | 'model.completed' | 'model.failed' | 'model.cancelled' }>): Promise<void>;
  send(command: AgentRuntimeResponse): void;
  onEvent(listener: (event: AgentUtilityEvent) => void): () => void;
  onExit(listener: () => void): () => void;
  stop(): Promise<void>;
}

export class AgentFacade {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly unsubscribeRuntime: () => void;
  private readonly unsubscribeExit: () => void;
  private startup: Promise<void> | undefined;

  constructor(private readonly runtime: AgentRuntimePort, private readonly modelTransport: AgentModelTransport, private readonly toolDispatcher?: AgentToolDispatcher) {
    this.unsubscribeRuntime = runtime.onEvent((event) => this.handleRuntimeEvent(event));
    this.unsubscribeExit = runtime.onExit(() => this.handleRuntimeExit());
  }

  async start(title?: string): Promise<AgentSession> {
    await this.ensureStarted();
    const now = new Date().toISOString();
    const session: AgentSession = { id: `agent_${randomUUID().replaceAll('-', '')}`, title: title?.trim() || '新对话', status: 'idle', messages: [], createdAt: now, updatedAt: now };
    await this.runtime.request({ type: 'session.start', requestId: randomUUID(), sessionId: session.id });
    this.sessions.set(session.id, session);
    this.emit({ type: 'session.updated', session });
    return session;
  }

  async send(sessionId: string, message: string): Promise<void> {
    await this.ensureStarted();
    const session = this.requireSession(sessionId);
    const now = new Date().toISOString();
    const userMessage: AgentMessage = { id: randomUUID(), role: 'user', content: message, at: now };
    this.replaceSession({ ...session, title: session.messages.length === 0 ? message.slice(0, 80) : session.title, status: 'running', messages: [...session.messages, userMessage], updatedAt: now });
    try {
      await this.runtime.request({ type: 'session.send', requestId: randomUUID(), sessionId, message });
    } catch (error) {
      this.markFailed(sessionId, '无法将消息发送给知己 Agent，请重试。');
      throw error;
    }
  }

  async cancel(sessionId: string): Promise<void> {
    await this.ensureStarted();
    this.requireSession(sessionId);
    await this.runtime.request({ type: 'session.cancel', requestId: randomUUID(), sessionId });
  }

  list(): AgentSession[] {
    return [...this.sessions.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  get(sessionId: string): AgentSession {
    return this.requireSession(sessionId);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribeRuntime();
    this.unsubscribeExit();
    this.modelTransport.dispose();
    await this.runtime.stop();
  }

  private async ensureStarted(): Promise<void> {
    this.startup ??= this.runtime.start();
    try { await this.startup; }
    catch (error) { this.startup = undefined; throw error; }
  }

  private handleRuntimeEvent(event: AgentUtilityEvent): void {
    if (event.type === 'model.request') { void this.modelTransport.stream(event as AgentModelRequest, (command) => this.runtime.send(command)); return; }
    if (event.type === 'model.cancel') { this.modelTransport.cancel(event.requestId); return; }
    if (event.type === 'tool.request') { void this.dispatchTool(event); return; }
    if (event.type === 'session.status') {
      const session = this.sessions.get(event.sessionId);
      if (session) this.replaceSession({ ...session, status: event.status, updatedAt: new Date().toISOString() });
      return;
    }
    if (event.type === 'message.delta') {
      this.emit({ type: 'message.delta', sessionId: event.sessionId, messageId: event.messageId, delta: event.delta });
      return;
    }
    if (event.type === 'message.completed') {
      const session = this.sessions.get(event.sessionId);
      if (!session) return;
      this.replaceSession({ ...session, messages: [...session.messages, event.message], updatedAt: event.message.at });
      this.emit({ type: 'message.completed', sessionId: event.sessionId, message: event.message });
      return;
    }
    if (event.type === 'tool.activity' || event.type === 'ui.navigate' || event.type === 'ui.present') {
      this.emit(event);
      return;
    }
    if (event.type === 'runtime.error') this.markFailed(event.sessionId, event.message);
  }

  private async dispatchTool(event: Extract<AgentUtilityEvent, { type: 'tool.request' }>): Promise<void> {
    const result = await (this.toolDispatcher?.dispatch(event) ?? Promise.resolve({ kind: 'error' as const, message: '知己工具当前不可用。' }));
    this.runtime.send({ type: 'tool.result', requestId: event.requestId, result });
  }

  private handleRuntimeExit(): void {
    this.startup = undefined;
    for (const session of this.sessions.values()) {
      if (session.status === 'running') this.markFailed(session.id, '知己 Agent 运行已停止；现有页面仍可继续使用。');
    }
  }

  private markFailed(sessionId: string | undefined, message: string): void {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) this.replaceSession({ ...session, status: 'failed', updatedAt: new Date().toISOString() });
    }
    this.emit({ type: 'error', ...(sessionId ? { sessionId } : {}), message });
  }

  private replaceSession(session: AgentSession): void {
    this.sessions.set(session.id, session);
    this.emit({ type: 'session.updated', session });
  }

  private requireSession(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw appError({ code: 'NOT_FOUND', entity: '这个 Agent 会话' });
    return session;
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
