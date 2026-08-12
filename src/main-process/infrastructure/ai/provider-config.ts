import { z } from 'zod';
import { appError } from '../../../shared/errors/app-error';

export const PROVIDER_PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
} as const;

export const ProviderConfigSchema = z.object({
  providerId: z.enum(['openai', 'deepseek', 'custom']),
  baseUrl: z.string().trim().min(1).max(2048),
  model: z.string().trim().min(1).max(160),
}).strict();

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type PublicProviderConfig = ProviderConfig & { hasApiKey: boolean };

export function normalizeProviderConfig(input: ProviderConfig, allowLoopbackHttp = false): ProviderConfig {
  const config = ProviderConfigSchema.parse(input);
  let url: URL;
  try { url = new URL(config.baseUrl); } catch { throw appError({ code: 'INVALID_INPUT', message: 'API 地址无效。' }); }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.username || url.password || (url.protocol !== 'https:' && !(allowLoopbackHttp && url.protocol === 'http:' && loopback))) {
    throw appError({ code: 'INVALID_INPUT', message: 'API 地址必须使用 HTTPS；开发环境仅允许本机 HTTP。' });
  }
  url.hash = '';
  url.search = '';
  return { ...config, baseUrl: url.toString().replace(/\/$/, '') };
}
