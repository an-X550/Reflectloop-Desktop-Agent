import { TavilyKeylessLimitError } from '@tavily/core';
import { describe, expect, it, vi } from 'vitest';
import { TavilyWebSearchProvider } from '../../src/main-process/infrastructure/web/tavily-web-search-provider';

const searchResponse = {
  query: 'Electron net.fetch',
  responseTime: 0.2,
  images: [],
  requestId: 'req_search',
  results: [{
    title: 'Electron net.fetch',
    url: 'https://www.electronjs.org/docs/latest/api/net',
    content: 'Chromium 原生网络栈。',
    rawContent: 'Chromium 原生网络栈的正文。',
    score: 0.9,
    publishedDate: '',
    id: 'result_1',
  }],
};

const extractResponse = {
  responseTime: 0.2,
  requestId: 'req_extract',
  results: [{ title: 'Electron net.fetch', url: 'https://www.electronjs.org/docs/latest/api/net', rawContent: '提取的来源正文。' }],
  failedResults: [],
};

function makeClient() {
  return {
    search: vi.fn(async () => searchResponse),
    extract: vi.fn(async () => extractResponse),
  };
}

describe('TavilyWebSearchProvider', () => {
  it('uses bounded search and extract options and maps only safe fields', async () => {
    const client = makeClient();
    const provider = new TavilyWebSearchProvider(client);

    await expect(provider.search('Electron net.fetch')).resolves.toEqual({
      requestId: 'req_search',
      results: [{ title: 'Electron net.fetch', url: 'https://www.electronjs.org/docs/latest/api/net', content: 'Chromium 原生网络栈的正文。', publishedAt: null }],
    });
    await expect(provider.extract('https://www.electronjs.org/docs/latest/api/net')).resolves.toEqual({
      requestId: 'req_extract',
      results: [{ title: 'Electron net.fetch', url: 'https://www.electronjs.org/docs/latest/api/net', content: '提取的来源正文。' }],
    });

    expect(client.search).toHaveBeenCalledWith('Electron net.fetch', expect.objectContaining({ maxResults: 8, includeRawContent: 'text', timeout: 20 }));
    expect(client.extract).toHaveBeenCalledWith(['https://www.electronjs.org/docs/latest/api/net'], expect.objectContaining({ format: 'text', timeout: 20 }));
  });

  it('classifies keyless quota responses with a bounded retry hint', async () => {
    const client = makeClient();
    client.search.mockRejectedValue(new TavilyKeylessLimitError({ message: 'shared keyless cap', capType: 'keyless_hourly_limit', retryAfter: 45, bonusEligible: false, continuationPaths: [] }));
    const provider = new TavilyWebSearchProvider(client);

    await expect(provider.search('额度')).rejects.toMatchObject({ code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 45, message: '搜索服务共享额度已用尽，请稍后再试。' });
  });

  it('classifies timeout and unavailable failures without leaking SDK text', async () => {
    const client = makeClient();
    client.search.mockRejectedValueOnce(Object.assign(new Error('Request timed out secret=do-not-leak'), { code: 'ETIMEDOUT' }));
    client.extract.mockRejectedValueOnce(Object.assign(new Error('ECONNREFUSED secret=do-not-leak'), { code: 'ECONNREFUSED' }));
    const provider = new TavilyWebSearchProvider(client);

    await expect(provider.search('超时')).rejects.toMatchObject({ code: 'SEARCH_TIMEOUT' });
    await expect(provider.extract('https://example.com')).rejects.toMatchObject({ code: 'SEARCH_UNAVAILABLE', message: '搜索服务暂时不可用，请稍后再试。' });
  });
});
