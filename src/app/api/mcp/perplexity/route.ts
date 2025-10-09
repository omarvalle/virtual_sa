import { NextResponse } from 'next/server';

import { isPerplexityApiEnabled } from '@/lib/config/env';
import {
  callPerplexitySearch,
  type PerplexitySearchRequest,
} from '@/lib/mcp/perplexity';

type IncomingPayload = {
  tool?: string;
  arguments?: Record<string, unknown>;
};

function ensureStringArray(value: unknown, label: string): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${label} must not be empty.`);
    }
    return [trimmed];
  }

  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    if (entries.length === 0) {
      throw new Error(`${label} array must include at least one non-empty string.`);
    }
    return entries;
  }

  throw new Error(`${label} must be a string or an array of strings.`);
}

function parseRequest(payload: IncomingPayload): PerplexitySearchRequest {
  const tool = payload.tool;
  const args = payload.arguments ?? {};

  if (!tool || typeof tool !== 'string') {
    throw new Error('Request must include a tool identifier.');
  }

  if (tool !== 'perplexity_search') {
    throw new Error(`Unsupported Perplexity tool '${tool}'.`);
  }

  const queryValue = args.query;
  if (queryValue === undefined || queryValue === null) {
    throw new Error('query is required for perplexity_search.');
  }

  const queries = ensureStringArray(queryValue, 'query');

  const request: PerplexitySearchRequest = {
    query: queries.length === 1 ? queries[0] : queries,
  };

  if (args.max_results !== undefined) {
    const parsed = Number(args.max_results);
    if (!Number.isFinite(parsed)) {
      throw new Error('max_results must be a number.');
    }
    request.maxResults = parsed;
  }

  if (args.max_tokens !== undefined) {
    const parsed = Number(args.max_tokens);
    if (!Number.isFinite(parsed)) {
      throw new Error('max_tokens must be a number.');
    }
    request.maxTokens = parsed;
  }

  if (args.max_tokens_per_page !== undefined) {
    const parsed = Number(args.max_tokens_per_page);
    if (!Number.isFinite(parsed)) {
      throw new Error('max_tokens_per_page must be a number.');
    }
    request.maxTokensPerPage = parsed;
  }

  if (args.country !== undefined && args.country !== null) {
    if (typeof args.country !== 'string' || args.country.trim().length !== 2) {
      throw new Error('country must be a 2-letter ISO code.');
    }
    request.country = args.country.toUpperCase();
  }

  if (args.search_mode !== undefined && args.search_mode !== null) {
    const mode = args.search_mode;
    if (mode !== 'web' && mode !== 'academic' && mode !== 'sec') {
      throw new Error('search_mode must be one of web, academic, or sec.');
    }
    request.searchMode = mode;
  }

  return request;
}

export async function POST(request: Request) {
  if (!isPerplexityApiEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Perplexity integration is not enabled. Provide PERPLEXITY_API_KEY to enable it.',
      },
      { status: 400 },
    );
  }

  let payload: IncomingPayload;

  try {
    payload = (await request.json()) as IncomingPayload;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid JSON payload',
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }

  let searchRequest: PerplexitySearchRequest;
  try {
    searchRequest = parseRequest(payload);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to parse Perplexity request.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await callPerplexitySearch(searchRequest);
    const segments = result.results.map((entry, index) => {
      const leading = `${index + 1}. ${entry.title}${entry.date ? ` (${entry.date})` : ''}${
        entry.url ? ` — ${entry.url}` : ''
      }`;
      const snippet = entry.snippet ? `\n${entry.snippet}` : '';
      return {
        type: 'text' as const,
        text: `${leading}${snippet}`,
      };
    });

    return NextResponse.json({
      success: result.success,
      result,
      segments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Perplexity search request failed.',
      },
      { status: 502 },
    );
  }
}
