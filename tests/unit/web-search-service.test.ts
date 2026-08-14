import { describe, expect, it, vi } from 'vitest';
import { WebSearchService } from '../../src/main-process/infrastructure/web/web-search-service';

const ddgHtml = `
<html><body>
<div class="result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle-1&amp;rut=abc">化债对行业的影响</a>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle-1">2026年 &amp; 化债政策下的行业观察摘要</a></div>
<div class="result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fother.org%2Fpost&amp;rut=def">第二个来源</a>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fother.org%2Fpost">第二段摘要</a></div>
</body></html>`;

const articleHtml = `<html><head><title>化债对行业的影响 - 示例站</title></head><body><script>var x=1;</script><style>.a{}</style><article>这里是正文内容，讨论化债背景下的行业选择。它包含足够的细节供阅读参考。</article></body></html>`;

const makeFetch = (handler: (url: string) => string) => vi.fn(async (url: unknown) => new Response(handler(String(url)), { status: 200 })) as unknown as typeof fetch;

describe('WebSearchService.search', () => {
  it('parses results with source, url, snippet and retrieval date', async () => {
    const service = new WebSearchService(makeFetch(() => ddgHtml), () => '2026-08-14T10:00:00.000Z');
    const { searchSessionId, results } = await service.search({ query: '化债 行业选择' });
    expect(searchSessionId).toMatch(/^search_[a-z0-9]+$/);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: '化债对行业的影响', url: 'https://example.com/article-1', publishedAt: null, retrievedAt: '2026-08-14T10:00:00.000Z' });
    expect(results[0].snippet).toContain('化债政策下的行业观察摘要');
    expect(results[0].sourceId).toMatch(/^source_[a-z0-9]+$/);
  });

  it('returns an empty result list when the search page has no results', async () => {
    const service = new WebSearchService(makeFetch(() => '<html><body>no results</body></html>'));
    const { results } = await service.search({ query: 'nothing' });
    expect(results).toEqual([]);
  });
});

describe('WebSearchService.readSource', () => {
  it('reads a source that belongs to the current search session', async () => {
    const service = new WebSearchService(makeFetch((url) => url.includes('duckduckgo') ? ddgHtml : articleHtml), () => '2026-08-14T10:00:00.000Z');
    const { searchSessionId, results } = await service.search({ query: '化债' });
    const source = await service.readSource({ searchSessionId, sourceId: results[0].sourceId });
    expect(source.title).toBe('化债对行业的影响 - 示例站');
    expect(source.url).toBe('https://example.com/article-1');
    expect(source.excerpt).toContain('化债背景下的行业选择');
    expect(source.excerpt).not.toContain('var x=1');
  });

  it('rejects a forged sourceId that does not belong to the search session', async () => {
    const service = new WebSearchService(makeFetch((url) => url.includes('duckduckgo') ? ddgHtml : articleHtml));
    const { searchSessionId } = await service.search({ query: '化债' });
    await expect(service.readSource({ searchSessionId, sourceId: 'source_forged99' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects reads from an unknown search session', async () => {
    const service = new WebSearchService(makeFetch(() => ddgHtml));
    await expect(service.readSource({ searchSessionId: 'search_unknown1', sourceId: 'source_a1' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
