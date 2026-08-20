import path from 'node:path';
import { MessageChannelMain, utilityProcess, type MessagePortMain, type UtilityProcess } from 'electron';
import { AgentUtilityEventSchema, type AgentModelResponse, type AgentUtilityCommand, type AgentUtilityEvent } from '../../shared/schemas/agent-protocol';
import type { AgentRuntimePort } from './agent-facade';

type PendingCommand = { resolve(): void; reject(error: Error): void };

/** Electron-only owner for the Utility Process and its one structured MessagePort. */
export class ElectronAgentRuntime implements AgentRuntimePort {
  private child: UtilityProcess | undefined;
  private port: MessagePortMain | undefined;
  private startup: Promise<void> | undefined;
  private readonly eventListeners = new Set<(event: AgentUtilityEvent) => void>();
  private readonly exitListeners = new Set<() => void>();
  private readonly pending = new Map<string, PendingCommand>();
  private stopping = false;
  private ready = false;
  private resolveStartup: (() => void) | undefined;
  private rejectStartup: ((error: Error) => void) | undefined;

  constructor(private readonly utilityEntry: string = path.join(__dirname, 'utility.js')) {}

  async start(): Promise<void> {
    this.startup ??= this.launch();
    try { await this.startup; }
    catch (error) { this.startup = undefined; throw error; }
  }

  async request(command: Exclude<AgentUtilityCommand, { type: 'model.delta' | 'model.completed' | 'model.failed' | 'model.cancelled' }>): Promise<void> {
    await this.start();
    const port = this.port;
    if (!port) throw new Error('知己 Agent 未启动。');
    return new Promise<void>((resolve, reject) => {
      this.pending.set(command.requestId, { resolve, reject });
      port.postMessage(command);
    });
  }

  send(command: AgentModelResponse): void {
    this.port?.postMessage(command);
  }

  onEvent(listener: (event: AgentUtilityEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onExit(listener: () => void): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.stopping = true;
    try { await this.request({ type: 'runtime.shutdown', requestId: crypto.randomUUID() }); }
    catch { /* A crashed utility process is already stopped from the user's perspective. */ }
    this.port?.close();
    if (this.child.pid !== undefined) this.child.kill();
    this.child = undefined;
    this.port = undefined;
    this.startup = undefined;
  }

  private launch(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = utilityProcess.fork(this.utilityEntry, [], { stdio: 'pipe' });
      const channel = new MessageChannelMain();
      this.child = child;
      this.port = channel.port1;
      this.stopping = false;
      this.ready = false;
      this.resolveStartup = resolve;
      this.rejectStartup = reject;
      channel.port1.on('message', (event) => this.handleMessage(event.data));
      channel.port1.start();
      child.once('spawn', () => child.postMessage({ type: 'agent-port' }, [channel.port2]));
      child.on('exit', () => this.handleExit());
      child.on('error', () => this.handleExit());
    });
  }

  private handleMessage(raw: unknown): void {
    const parsed = AgentUtilityEventSchema.safeParse(raw);
    if (!parsed.success) return;
    const event = parsed.data;
    if (event.type === 'runtime.ready') { this.ready = true; this.resolveStartup?.(); this.resolveStartup = undefined; this.rejectStartup = undefined; return; }
    if (event.type === 'command.completed') { this.pending.get(event.requestId)?.resolve(); this.pending.delete(event.requestId); return; }
    if (event.type === 'command.failed') { this.pending.get(event.requestId)?.reject(new Error(event.message)); this.pending.delete(event.requestId); return; }
    if (event.type === 'runtime.error' && !this.ready) { this.rejectStartup?.(new Error(event.message)); this.resolveStartup = undefined; this.rejectStartup = undefined; return; }
    for (const listener of this.eventListeners) listener(event);
  }

  private handleExit(): void {
    const error = new Error('知己 Agent 运行已停止。');
    if (!this.ready) this.rejectStartup?.(error);
    this.resolveStartup = undefined;
    this.rejectStartup = undefined;
    this.ready = false;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    const notify = !this.stopping;
    this.child = undefined;
    this.port?.close();
    this.port = undefined;
    this.startup = undefined;
    if (notify) for (const listener of this.exitListeners) listener();
  }
}
