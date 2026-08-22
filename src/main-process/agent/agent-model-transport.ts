import type { ConfigureAi } from '../application/configure-ai';
import type { AgentModelRequest, AgentModelResponse, AgentRuntimeModelConfig } from '../../shared/schemas/agent-protocol';

/** Main-process-only model relay. It deliberately owns the API key boundary. */
export class AgentModelTransport {
  private readonly active = new Map<string, AbortController>();

  constructor(private readonly configureAi: ConfigureAi) {}

  async getRuntimeModelConfig(): Promise<AgentRuntimeModelConfig> {
    const config = await this.configureAi.getPublicConfig();
    return { providerId: config.providerId, model: config.model };
  }

  async stream(request: AgentModelRequest, send: (command: AgentModelResponse) => void): Promise<void> {
    const controller = new AbortController();
    this.active.set(request.requestId, controller);
    try {
      const messages = [
        ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
        ...request.messages.map((message) => message.role === 'assistant'
          ? { role: 'assistant' as const, content: message.content, ...(message.reasoning ? { reasoning: message.reasoning } : {}), ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}) }
          : message),
      ];
      for await (const delta of this.configureAi.streamAgent(messages, request.tools ?? [], controller.signal)) {
        if (delta.kind === 'text') send({ type: 'model.delta', requestId: request.requestId, delta: delta.text });
        else if (delta.kind === 'reasoning') send({ type: 'model.reasoning-delta', requestId: request.requestId, delta: delta.text });
        else send({ type: 'model.tool-call', requestId: request.requestId, index: delta.index, callId: delta.callId, ...(delta.name ? { name: delta.name } : {}), argumentsDelta: delta.argumentsDelta });
      }
      send({ type: 'model.completed', requestId: request.requestId });
    } catch (error) {
      if (controller.signal.aborted) send({ type: 'model.cancelled', requestId: request.requestId });
      else send({ type: 'model.failed', requestId: request.requestId, message: toChineseModelError(error) });
    } finally {
      this.active.delete(request.requestId);
    }
  }

  cancel(requestId: string): void {
    this.active.get(requestId)?.abort();
  }

  dispose(): void {
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
  }
}

function toChineseModelError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('API Key') || message.includes('密钥')) return '请先在设置中保存可用的 API Key。';
  if (message.includes('取消')) return '已停止本次 Agent 请求。';
  return '模型请求失败，请检查网络、模型和设置后重试。';
}
