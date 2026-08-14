import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigureAi } from '../../src/main-process/application/configure-ai';

const emptyCredentials = { read: async () => null, save: async () => undefined, delete: async () => undefined } as never;

describe('ConfigureAi 缺少 API Key 时的错误', () => {
  it('testConnection 抛出带中文文案的结构化错误', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-configure-ai-'));
    const service = new ConfigureAi(root, emptyCredentials);
    await expect(service.testConnection({ providerId: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini' }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT', message: '请先填写 API Key。' });
  });

  it('collect 抛出带中文文案的结构化错误', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zhiji-configure-ai-'));
    const service = new ConfigureAi(root, emptyCredentials);
    await expect(service.collect([{ role: 'user', content: '你好' }]))
      .rejects.toMatchObject({ code: 'INVALID_INPUT', message: '请先在设置中保存 API Key。' });
  });
});
