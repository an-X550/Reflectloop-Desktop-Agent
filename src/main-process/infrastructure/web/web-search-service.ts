import crypto from 'node:crypto';
import { appError } from '../../../shared/errors/app-error';
import { WebSearchResultSchema, WebSourceContentSchema, type WebSearchResult, type WebSourceContent } from '../../../shared/schemas/domain';
import {
  TavilyWebSearchProvider,
  type WebSearchProvider,
  type WebSearchProviderResult,
  type WebSourceProviderResult,
  toSearchAppError,
} from './tavily-web-search-provider';

const MAX_RESULTS = 8;
const MAX_SNIPPET = 1_000;
const MAX_EXCERPT = 2_000;
const MAX_SESSIONS = 20;

type StoredSearchResult = WebSearchResult & { content: string };

interface WebSearchSession {
  id: string;
  query: string;
  results: StoredSearchResult[];
  createdAt: string;
}

function safeProviderText(value: string | null | undefined, limit: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function parsePublicUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url;
  } catch {
    return null;
  }
}

function sourceId(): string {
  return `source_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

function searchSessionId(): string {
  return `search_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function providerResultToStored(result: WebSearchProviderResult, now: string): StoredSearchResult | null {
  const url = parsePublicUrl(result.url);
  const title = safeProviderText(result.title, 300);
  if (!url || !title) return null;
  const content = safeProviderText(result.content, MAX_EXCERPT);
  return {
    ...WebSearchResultSchema.parse({
      sourceId: sourceId(),
      title,
      url: url.toString(),
      domain: url.hostname,
      snippet: content.slice(0, MAX_SNIPPET),
      publishedAt: safeProviderText(result.publishedAt, 40) || null,
      retrievedAt: now,
    }),
    content,
  };
}

function extractedContent(result: WebSourceProviderResult | undefined): string {
  return safeProviderText(result?.content, MAX_EXCERPT);
}

/**
 * Controlled web access: Tavily owns search/extraction, while this service
 * owns session binding, bounded content, and source provenance.
 */
export class WebSearchService {
  private readonly sessions = new Map<string, WebSearchSession>();

  constructor(
    private readonly provider: WebSearchProvider = new TavilyWebSearchProvider(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async search(input: { query: string }): Promise<{ searchSessionId: string; results: WebSearchResult[] }> {
    let response;
    try {
      response = await this.provider.search(input.query);
    } catch (error) {
      throw toSearchAppError(error);
    }
    const retrievedAt = this.now();
    const results = response.results
      .slice(0, MAX_RESULTS)
      .map((result) => providerResultToStored(result, retrievedAt))
      .filter((result): result is StoredSearchResult => Boolean(result));
    if (results.length === 0) throw appError({ code: 'SEARCH_EMPTY' });

    const session: WebSearchSession = {
      id: searchSessionId(),
      query: input.query,
      results,
      createdAt: retrievedAt,
    };
    this.sessions.set(session.id, session);
    while (this.sessions.size > MAX_SESSIONS) {
      const oldest = this.sessions.keys().next();
      if (oldest.done) break;
      this.sessions.delete(oldest.value);
    }
    return { searchSessionId: session.id, results };
  }

  async readSource(input: { searchSessionId: string; sourceId: string }): Promise<WebSourceContent> {
    const session = this.sessions.get(input.searchSessionId);
    if (!session) throw appError({ code: 'INVALID_INPUT', message: '搜索会话不存在或已过期，请重新搜索。' });
    const index = session.results.findIndex((item) => item.sourceId === input.sourceId);
    if (index < 0) throw appError({ code: 'INVALID_INPUT', message: '来源不属于当前搜索会话，已拒绝读取。' });
    const result = session.results[index];
    const url = parsePublicUrl(result.url);
    if (!url) throw appError({ code: 'INVALID_INPUT', message: '只允许读取搜索会话中的公开来源。' });

    let content = result.content;
    let title = result.title;
    if (!content) {
      let response;
      try {
        response = await this.provider.extract(result.url);
      } catch (error) {
        const mapped = toSearchAppError(error);
        if (mapped.code === 'SEARCH_UNAVAILABLE') throw appError({ code: 'SOURCE_UNAVAILABLE' });
        throw mapped;
      }
      const extracted = response.results.find((item) => item.url === result.url || parsePublicUrl(item.url)?.toString() === result.url);
      content = extractedContent(extracted);
      title = safeProviderText(extracted?.title, 300) || title;
      if (!content) throw appError({ code: 'SOURCE_UNAVAILABLE' });
      session.results[index] = { ...result, title, content };
    }

    return WebSourceContentSchema.parse({
      title,
      url: result.url,
      domain: result.domain,
      publishedAt: result.publishedAt,
      retrievedAt: result.retrievedAt,
      excerpt: content.slice(0, MAX_EXCERPT),
    });
  }
}
