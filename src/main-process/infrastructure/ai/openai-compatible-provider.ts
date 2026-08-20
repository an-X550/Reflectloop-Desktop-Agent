import { appError } from '../../../shared/errors/app-error';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: Array<{ id: string; name: string; arguments: string }> }
  | { role: 'tool'; content: string; toolCallId: string };
export interface CollectOptions { jsonObject?: boolean }
export interface AgentToolSpec { name: string; description: string; parameters: Record<string, unknown> }
export type AgentStreamDelta = { kind: 'text'; text: string } | { kind: 'tool-call'; index: number; callId: string; name?: string; argumentsDelta: string };

/** AI 请求 60 秒未返回视为超时；与调用方传入的取消信号合并。 */
const AI_REQUEST_TIMEOUT_MS = 60_000;

function mapNetworkError(signal?: AbortSignal): Error {
  if (signal?.aborted) return appError({ code: 'CANCELLED' });
  return appError({ code: 'NETWORK_TIMEOUT' });
}

export class OpenAiCompatibleProvider {
  constructor(private readonly config: { baseUrl: string; model: string; apiKey: string }) {}

  async *stream(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): AsyncGenerator<string> {
    for await (const delta of this.streamFrames(messages, signal, options)) if (delta.kind === 'text') yield delta.text;
  }

  async *streamAgent(messages: ChatMessage[], tools: AgentToolSpec[], signal?: AbortSignal): AsyncGenerator<AgentStreamDelta> {
    yield* this.streamFrames(messages, signal, undefined, tools);
  }

  private async *streamFrames(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions, tools?: AgentToolSpec[]): AsyncGenerator<AgentStreamDelta> {
    const combined = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST', signal: combined,
        headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, messages: messages.map((message) => message.role === 'tool'
          ? { role: 'tool', content: message.content, tool_call_id: message.toolCallId }
          : message.role === 'assistant' && message.toolCalls?.length
            ? { role: 'assistant', content: message.content, tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } })) }
            : { role: message.role, content: message.content }), stream: true, ...(options?.jsonObject ? { response_format: { type: 'json_object' } } : {}), ...(tools?.length ? { tools: tools.map((tool) => ({ type: 'function', function: tool })) } : {}) }),
      });
    } catch {
      throw mapNetworkError(signal);
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw appError({ code: 'INVALID_API_KEY' });
      if (response.status === 404) throw appError({ code: 'MODEL_NOT_FOUND', model: this.config.model });
      if (response.status === 429) throw appError({ code: 'RATE_LIMITED' });
      throw appError({ code: 'UNKNOWN', message: `接口返回 ${response.status}` });
    }
    if (!response.body) throw appError({ code: 'UNKNOWN', message: '接口没有返回内容。' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    const toolCallIds = new Map<number, string>();
    for (;;) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await reader.read());
      } catch {
        throw mapNetworkError(signal);
      }
      pending += decoder.decode(value, { stream: !done });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? '';
      for (const frame of frames) {
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          let payload: unknown;
          try { payload = JSON.parse(data); }
          catch { continue; }
          const delta = (payload as { choices?: Array<{ delta?: { content?: unknown; tool_calls?: Array<{ index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }> } }> } | null)?.choices?.[0]?.delta;
          const text = delta?.content;
          if (typeof text === 'string') yield { kind: 'text', text };
          for (const call of delta?.tool_calls ?? []) {
            if (typeof call.index !== 'number' || !Number.isInteger(call.index)) continue;
            const callId = typeof call.id === 'string' ? call.id : toolCallIds.get(call.index);
            if (!callId) continue;
            toolCallIds.set(call.index, callId);
            const name = typeof call.function?.name === 'string' ? call.function.name : undefined;
            const argumentsDelta = typeof call.function?.arguments === 'string' ? call.function.arguments : '';
            yield { kind: 'tool-call', index: call.index, callId, ...(name ? { name } : {}), argumentsDelta };
          }
        }
      }
      if (done) return;
    }
  }

  async collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string> {
    let output = '';
    for await (const delta of this.stream(messages, signal, options)) output += delta;
    return output;
  }

  async testConnection(signal?: AbortSignal): Promise<void> {
    await this.collect([{ role: 'user', content: 'Reply with OK.' }], signal);
  }
}
