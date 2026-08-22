import {
  TavilyKeylessLimitError,
  tavily,
  type TavilyClient,
  type TavilyExtractResponse,
  type TavilySearchResponse,
} from '@tavily/core';
import { appError, type AppError } from '../../../shared/errors/app-error';

export const TAVILY_SEARCH_TIMEOUT_SECONDS = 20;
export const TAVILY_MAX_RESULTS = 8;

export type WebSearchProviderResult = {
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
};

export type WebSourceProviderResult = {
  title: string | null;
  url: string;
  content: string;
};

export type WebSearchProviderResponse = {
  requestId: string;
  results: WebSearchProviderResult[];
};

export type WebSourceProviderResponse = {
  requestId: string;
  results: WebSourceProviderResult[];
};

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchProviderResponse>;
  extract(url: string): Promise<WebSourceProviderResponse>;
}

type TavilyClientLike = Pick<TavilyClient, 'search' | 'extract'>;

function createKeylessClient(): TavilyClientLike {
  // The product intentionally uses Tavily's public keyless path. Clearing the
  // ambient variable prevents a developer-shell secret from changing this
  // behavior or being sent by the desktop app.
  process.env.TAVILY_API_KEY = '';
  return tavily();
}

function readCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
}

function readRetryAfter(error: unknown): number | undefined {
  const value = typeof error === 'object' && error !== null && 'retryAfter' in error
    ? (error as { retryAfter?: unknown }).retryAfter
    : undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.floor(value), 86_400);
}

function isTimeoutError(error: unknown): boolean {
  const code = readCode(error);
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'UND_ERR_CONNECT_TIMEOUT') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('timeout') || message.includes('timed out');
}

function isAppSearchError(error: unknown): error is AppError & Error {
  const code = readCode(error);
  return code === 'SEARCH_UNAVAILABLE'
    || code === 'SEARCH_TIMEOUT'
    || code === 'SEARCH_RATE_LIMITED'
    || code === 'SEARCH_EMPTY'
    || code === 'SOURCE_UNAVAILABLE'
    || code === 'SEARCH_NOT_CONFIGURED';
}

/** Convert SDK/network failures to a small, provider-independent safe error set. */
export function toSearchAppError(error: unknown): AppError & Error {
  if (isAppSearchError(error)) return error;
  if (error instanceof TavilyKeylessLimitError) {
    return appError({ code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: readRetryAfter(error) });
  }
  if (isTimeoutError(error)) return appError({ code: 'SEARCH_TIMEOUT' });
  return appError({ code: 'SEARCH_UNAVAILABLE' });
}

function mapSearchResponse(response: TavilySearchResponse): WebSearchProviderResponse {
  return {
    requestId: response.requestId,
    results: response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.rawContent?.trim() || result.content,
      publishedAt: result.publishedDate || null,
    })),
  };
}

function mapExtractResponse(response: TavilyExtractResponse): WebSourceProviderResponse {
  return {
    requestId: response.requestId,
    results: response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.rawContent,
    })),
  };
}

/** Official Tavily SDK adapter. It exposes only bounded search and extract operations. */
export class TavilyWebSearchProvider implements WebSearchProvider {
  constructor(
    private readonly client: TavilyClientLike = createKeylessClient(),
    private readonly timeoutSeconds = TAVILY_SEARCH_TIMEOUT_SECONDS,
  ) {}

  async search(query: string): Promise<WebSearchProviderResponse> {
    try {
      const response = await this.client.search(query, {
        searchDepth: 'basic',
        maxResults: TAVILY_MAX_RESULTS,
        includeRawContent: 'text',
        maxTokens: 4_000,
        timeout: this.timeoutSeconds,
      });
      return mapSearchResponse(response);
    } catch (error) {
      throw toSearchAppError(error);
    }
  }

  async extract(url: string): Promise<WebSourceProviderResponse> {
    try {
      const response = await this.client.extract([url], {
        format: 'text',
        extractDepth: 'basic',
        timeout: this.timeoutSeconds,
      });
      return mapExtractResponse(response);
    } catch (error) {
      throw toSearchAppError(error);
    }
  }
}
