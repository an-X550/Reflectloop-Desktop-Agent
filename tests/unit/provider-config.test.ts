import { describe, expect, it } from 'vitest';
import { normalizeProviderConfig, PROVIDER_PRESETS } from '../../src/main-process/infrastructure/ai/provider-config';

describe('provider configuration', () => {
  it('uses a current DeepSeek model preset', () => {
    expect(PROVIDER_PRESETS.deepseek.defaultModel).toBe('deepseek-v4-flash');
  });

  it('accepts HTTPS and explicit loopback development endpoints', () => {
    expect(normalizeProviderConfig({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1/', model: 'gpt-5-mini', agentThinking: 'disabled' }).baseUrl)
      .toBe('https://api.openai.com/v1');
    expect(normalizeProviderConfig({ providerId: 'custom', baseUrl: 'http://127.0.0.1:11434/v1', model: 'local', agentThinking: 'disabled' }, true).baseUrl)
      .toBe('http://127.0.0.1:11434/v1');
  });

  it.each(['http://example.com/v1', 'file:///tmp/model', 'https://user:secret@example.com/v1', 'http://192.168.1.2/v1'])('rejects unsafe endpoint %s', (baseUrl) => {
    expect(() => normalizeProviderConfig({ providerId: 'custom', baseUrl, model: 'model', agentThinking: 'disabled' }, true)).toThrow();
  });
});
