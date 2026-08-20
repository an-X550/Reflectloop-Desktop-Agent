import { appError } from '../../../shared/errors/app-error';
import { ProviderConfigSchema, type ProviderConfig } from '../../../shared/schemas/domain';

// S5：配置类型定义已归位到 shared/schemas/domain.ts，此处保留再导出以兼容既有引用
export { ProviderConfigSchema };
export type { ProviderConfig };
export type { PublicProviderConfig } from '../../../shared/schemas/domain';

export const PROVIDER_PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-v4-flash' },
} as const;

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
