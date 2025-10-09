import Perplexity from '@perplexity-ai/perplexity_ai';

import {
  getPerplexityApiBaseUrl,
  getPerplexityApiKey,
} from '@/lib/config/env';

export type PerplexitySearchRequest = {
  query: string | string[];
  maxResults?: number;
  maxTokens?: number;
  maxTokensPerPage?: number;
  country?: string;
  searchMode?: 'web' | 'academic' | 'sec';
};

export type PerplexitySearchResult = {
  title: string;
  url: string;
  snippet: string;
  date?: string | null;
  lastUpdated?: string | null;
};

export type PerplexitySearchResponse = {
  success: boolean;
  results: PerplexitySearchResult[];
  raw: unknown;
};

const PERPLEXITY_DEFAULT_TIMEOUT = 45_000;

let cachedClient: Perplexity | null = null;

function getClient(): Perplexity {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new Perplexity({
    apiKey: getPerplexityApiKey(),
    baseURL: getPerplexityApiBaseUrl(),
    timeout: PERPLEXITY_DEFAULT_TIMEOUT,
  });

  return cachedClient;
}

export async function callPerplexitySearch(
  request: PerplexitySearchRequest,
  options: { signal?: AbortSignal } = {},
): Promise<PerplexitySearchResponse> {
  const client = getClient();

  const response = await client.search.create(
    {
      query: request.query,
      ...(request.maxResults ? { max_results: request.maxResults } : {}),
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.maxTokensPerPage ? { max_tokens_per_page: request.maxTokensPerPage } : {}),
      ...(request.country ? { country: request.country } : {}),
      ...(request.searchMode ? { search_mode: request.searchMode } : {}),
    },
    options,
  );

  const results = Array.isArray(response?.results)
    ? response.results.map((entry) => ({
        title: entry.title,
        url: entry.url,
        snippet: entry.snippet,
        date: entry.date ?? null,
        lastUpdated: entry.last_updated ?? null,
      }))
    : [];

  return {
    success: true,
    results,
    raw: response,
  };
}
