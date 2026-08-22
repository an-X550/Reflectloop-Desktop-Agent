import { describe, expect, it, vi } from 'vitest';
import { WebSearchService } from '../../src/main-process/infrastructure/web/web-search-service';
import type { WebSearchProvider, WebSearchProviderResult } from '../../src/main-process/infrastructure/web/tavily-web-search-provider';

const makeResult = (overrides: Partial<WebSearchProviderResult> = {}): WebSearchProviderResult => ({
  title: '可信来源',
  url: 'https://example.com/article-1',
  content: '来源正文，包含足够的公开信息供读取。',
  publishedAt: null,
  ...overrides,
});

function makeProvider(
  results: WebSearchProviderResult[] = [makeResult()],
  extracted: WebSearchProviderResult[] = [],
): WebSearchProvider & { search: ReturnType<typeof vi.fn>; extract: ReturnType<typeof vi.fn> } {
  return {
    search: vi.fn(async () => ({ requestId: 'request_search', results })),
    extract: vi.fn(async () => ({ requestId: 'request_extract', results: extracted })),
  };
}

describe('WebSearchService.search', () => {
  it('maps provider results to bounded provenance with a search session', async () => {
    const provider = makeProvider([makeResult({ title: 'Electron 官方说明', url: 'https://www.electronjs.org/docs/latest/api/net', content: 'Chromium 原生网络栈说明。', publishedAt: '2026-08-21' })]);
    const service = new WebSearchService(provider, () => '2026-08-14T10:00:00.000Z');
    const response = await service.search({ query: 'Electron net.fetch' });

    expect(provider.search).toHaveBeenCalledWith('Electron net.fetch');
    expect(response.searchSessionId).toMatch(/^search_[a-z0-9]+$/);
    expect(response.results).toEqual([expect.objectContaining({
      title: 'Electron 官方说明',
      url: 'https://www.electronjs.org/docs/latest/api/net',
      domain: 'www.electronjs.org',
      snippet: 'Chromium 原生网络栈说明。',
      publishedAt: '2026-08-21',
      retrievedAt: '2026-08-14T10:00:00.000Z',
    })]);
    expect(response.results[0].sourceId).toMatch(/^source_[a-z0-9]+$/);
  });

  it('classifies a provider timeout without exposing the provider error', async () => {
    const provider = makeProvider();
    provider.search.mockRejectedValue(Object.assign(new Error('axios timeout and secret=do-not-leak'), { code: 'ETIMEDOUT' }));
    const service = new WebSearchService(provider);

    await expect(service.search({ query: '超时' })).rejects.toMatchObject({ code: 'SEARCH_TIMEOUT' });
    await expect(service.search({ query: '超时' })).rejects.not.toThrow('do-not-leak');
  });

  it('turns an empty or invalid provider response into SEARCH_EMPTY', async () => {
    const provider = makeProvider([
      makeResult({ title: '', url: 'javascript:alert(1)' }),
      makeResult({ title: '也无效', url: 'file:///private/note', content: 'secret' }),
    ]);
    const service = new WebSearchService(provider);

    await expect(service.search({ query: '没有来源' })).rejects.toMatchObject({ code: 'SEARCH_EMPTY' });
  });

  it('does not create an empty session and evicts the oldest bounded session', async () => {
    let tick = 0;
    const provider = makeProvider();
    provider.search.mockImplementation(async (query: string) => ({
      requestId: query,
      results: [makeResult({ url: `https://example.com/${query}` })],
    }));
    const service = new WebSearchService(provider, () => `2026-08-14T10:${String(tick).padStart(2, '0')}:00.000Z`);
    const first = await service.search({ query: 'first' });
    for (let index = 0; index < 20; index += 1) {
      tick += 1;
      await service.search({ query: `query-${index}` });
    }

    await expect(service.readSource({ searchSessionId: first.searchSessionId, sourceId: first.results[0].sourceId })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('WebSearchService.readSource', () => {
  it('reads bounded content already returned by the provider without fetching an arbitrary URL', async () => {
    const provider = makeProvider([makeResult({ content: '搜索阶段已经返回的正文。' })]);
    const service = new WebSearchService(provider, () => '2026-08-14T10:00:00.000Z');
    const search = await service.search({ query: '受控来源' });
    const source = await service.readSource({ searchSessionId: search.searchSessionId, sourceId: search.results[0].sourceId });

    expect(provider.extract).not.toHaveBeenCalled();
    expect(source).toEqual({
      title: '可信来源',
      url: 'https://example.com/article-1',
      domain: 'example.com',
      publishedAt: null,
      retrievedAt: '2026-08-14T10:00:00.000Z',
      excerpt: '搜索阶段已经返回的正文。',
    });
  });

  it('uses provider extract only for a source saved in the current session', async () => {
    const provider = makeProvider(
      [makeResult({ content: '' })],
      [makeResult({ title: '提取后的来源', content: 'Tavily extract 返回的有限正文。' })],
    );
    const service = new WebSearchService(provider);
    const search = await service.search({ query: '需要读取正文' });
    const source = await service.readSource({ searchSessionId: search.searchSessionId, sourceId: search.results[0].sourceId });

    expect(provider.extract).toHaveBeenCalledWith('https://example.com/article-1');
    expect(source.title).toBe('提取后的来源');
    expect(source.excerpt).toContain('Tavily extract');
  });

  it('classifies an unavailable extraction as SOURCE_UNAVAILABLE', async () => {
    const provider = makeProvider([makeResult({ content: '' })]);
    provider.extract.mockRejectedValue(Object.assign(new Error('connection refused secret=do-not-leak'), { code: 'ECONNREFUSED' }));
    const service = new WebSearchService(provider);
    const search = await service.search({ query: '来源不可读' });

    await expect(service.readSource({ searchSessionId: search.searchSessionId, sourceId: search.results[0].sourceId })).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });

  it('rejects forged source IDs and unknown sessions', async () => {
    const service = new WebSearchService(makeProvider());
    const search = await service.search({ query: '绑定' });

    await expect(service.readSource({ searchSessionId: search.searchSessionId, sourceId: 'source_forged99' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(service.readSource({ searchSessionId: 'search_unknown1', sourceId: search.results[0].sourceId })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
