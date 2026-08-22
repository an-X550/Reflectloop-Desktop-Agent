import crypto from 'node:crypto';
import { appError } from '../../../shared/errors/app-error';
import { WebSearchResultSchema, WebSourceContentSchema, type WebSearchResult, type WebSourceContent } from '../../../shared/schemas/domain';

const MAX_RESULTS = 8;
const MAX_EXCERPT = 2000;
const MAX_SESSIONS = 20;

interface WebSearchSession {
  id: string;
  query: string;
  results: WebSearchResult[];
  createdAt: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractText(html: string): string {
  return stripTags(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, ''))
    .slice(0, MAX_EXCERPT);
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).slice(0, 300) : '';
}

function resolveResultUrl(href: string): string | null {
  const uddg = href.match(/[?&]uddg=([^&]+)/);
  if (uddg) {
    try { return decodeURIComponent(uddg[1]); } catch { return null; }
  }
  return href.startsWith('http') ? href : null;
}

/**
 * 受控联网：搜索与读取来源都由用户显式触发；readSource 只接受当前搜索会话返回过的 sourceId。
 */
export class WebSearchService {
  private readonly sessions = new Map<string, WebSearchSession>();

  constructor(
    private readonly fetchImpl: FetchImpl = (url, init) => fetch(url, init),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly timeoutMs = 15_000,
  ) {}

  private timedFetch(url: string): Promise<Response> {
    return this.fetchImpl(url, { headers: { 'user-agent': 'zhiji-desktop/1.0' }, signal: AbortSignal.timeout(this.timeoutMs) });
  }

  async search(input: { query: string }): Promise<{ searchSessionId: string; results: WebSearchResult[] }> {
    let response: Response;
    try {
      response = await this.timedFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`);
    } catch {
      throw appError({ code: 'NETWORK_TIMEOUT' });
    }
    if (!response.ok) throw appError({ code: 'WEB_SEARCH_FAILED', message: `搜索请求失败（HTTP ${response.status}）。` });
    const html = await response.text();
    const results: WebSearchResult[] = [];
    const anchorPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => stripTags(match[1]));
    let index = 0;
    for (const match of html.matchAll(anchorPattern)) {
      if (results.length >= MAX_RESULTS) break;
      const url = resolveResultUrl(match[1]);
      const title = stripTags(match[2]).slice(0, 300);
      if (!url || !title) continue;
      results.push(WebSearchResultSchema.parse({
        sourceId: `source_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
        title,
        url,
        snippet: (snippets[index] ?? '').slice(0, 1000),
        publishedAt: null,
        retrievedAt: this.now(),
      }));
      index += 1;
    }
    const session: WebSearchSession = {
      id: `search_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      query: input.query,
      results,
      createdAt: this.now(),
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
    const result = session.results.find((item) => item.sourceId === input.sourceId);
    if (!result) throw appError({ code: 'INVALID_INPUT', message: '来源不属于当前搜索会话，已拒绝读取。' });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw appError({ code: 'INVALID_INPUT', message: '只允许读取 http/https 来源。' });
    }
    let response: Response;
    try {
      response = await this.timedFetch(result.url);
    } catch {
      throw appError({ code: 'WEB_SOURCE_FAILED', message: '读取来源失败（网络超时或不可达）。' });
    }
    if (!response.ok) throw appError({ code: 'WEB_SOURCE_FAILED', message: `读取来源失败（HTTP ${response.status}）。` });
    const html = await response.text();
    return WebSourceContentSchema.parse({
      title: extractTitle(html) || result.title,
      url: result.url,
      publishedAt: result.publishedAt,
      excerpt: extractText(html),
    });
  }
}
