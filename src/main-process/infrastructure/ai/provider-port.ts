import type { ChatMessage, CollectOptions, StructuredCollectOptions, StructuredCompletion } from './openai-compatible-provider';

/**
 * AI 服务商统一端口：应用层与 skill-runtime 共用这一处定义。
 * stream 可选——只实现 collect 的假实现（测试）与真实服务商都满足该接口。
 */
export interface ProviderPort {
  collect(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): Promise<string>;
  collectStructured?(messages: ChatMessage[], signal: AbortSignal | undefined, options: StructuredCollectOptions): Promise<StructuredCompletion>;
  stream?(messages: ChatMessage[], signal?: AbortSignal, options?: CollectOptions): AsyncGenerator<string>;
}
