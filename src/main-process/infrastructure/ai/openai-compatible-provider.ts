import { appError } from '../../../shared/errors/app-error';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface CollectOptions { jsonObject?: boolean }

/** AI 请求 60 秒未返回视为超时；与调用方传入的取消信号合并。 */
const AI_REQUEST_TIMEOUT_MS = 60_000;

function mapNetworkError(signal?: AbortSignal): Error {
  if (signal?.aborted) return appError({ code: 'CANCELLED' });
  return appError({ code: 'NETWORK_TIMEOUT' });
}

export class OpenAiCompatibleProvider {
  constructor(private readonly config: { baseUrl: string; model: string; apiKey: string }) {}

  async *stream(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): AsyncGenerator<string> {
    const combined = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST', signal: combined,
        headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, messages, stream: true, ...(options?.jsonObject ? { response_format: { type: 'json_object' } } : {}) }),
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
          const delta = (payload as { choices?: Array<{ delta?: { content?: unknown } }> } | null)?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') yield delta;
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
