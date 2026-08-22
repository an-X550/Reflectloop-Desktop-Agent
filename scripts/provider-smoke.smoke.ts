import { describe, expect, it } from 'vitest';
import { TavilyWebSearchProvider } from '../src/main-process/infrastructure/web/tavily-web-search-provider';

const SMOKE_QUERY = '查找 Electron net.fetch 官方文档最近的说明';

describe('Tavily keyless provider smoke', () => {
  it('completes a non-empty search and reads one returned source', async () => {
    const provider = new TavilyWebSearchProvider();
    const search = await provider.search(SMOKE_QUERY);
    const first = search.results.find((result) => /^https?:\/\//i.test(result.url) && result.title.trim() && result.content.trim());
    expect(first).toBeDefined();
    if (!first) return;

    const extracted = await provider.extract(first.url);
    const source = extracted.results.find((result) => result.url === first.url && result.content.trim());
    expect(source).toBeDefined();
    console.log(JSON.stringify({
      provider: 'tavily-keyless',
      query: SMOKE_QUERY,
      requestIdsPresent: Boolean(search.requestId && extracted.requestId),
      searchResultCount: search.results.length,
      extractedResultCount: extracted.results.length,
      selectedDomain: new URL(first.url).hostname,
    }));
  }, 120_000);
});
