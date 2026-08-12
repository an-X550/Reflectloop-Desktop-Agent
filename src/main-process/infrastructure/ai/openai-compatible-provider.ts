import { appError } from '../../../shared/errors/app-error';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export class OpenAiCompatibleProvider {
  constructor(private readonly config: { baseUrl: string; model: string; apiKey: string }) {}

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST', signal,
        headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, messages, stream: true }),
      });
    } catch (error) {
      if (signal?.aborted) throw appError({ code: 'NETWORK_TIMEOUT' });
      throw appError({ code: 'NETWORK_TIMEOUT' });
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
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? '';
      for (const frame of frames) {
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') yield delta;
        }
      }
      if (done) return;
    }
  }

  async collect(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
    let output = '';
    for await (const delta of this.stream(messages, signal)) output += delta;
    return output;
  }

  async testConnection(signal?: AbortSignal): Promise<void> {
    await this.collect([{ role: 'user', content: 'Reply with OK.' }], signal);
  }
}
