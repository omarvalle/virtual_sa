import { getTavilyApiBaseUrl, getTavilyApiKey } from '@/lib/config/env';

export type TavilyToolName = 'tavily_search' | 'tavily_extract' | 'tavily_crawl' | 'tavily_map';

export type TavilyRequest = {
  name: TavilyToolName;
  arguments: Record<string, unknown>;
};

export type TavilySegment = {
  type: string;
  text?: string;
  parsed?: unknown;
  raw: unknown;
};

export type TavilyResponse = {
  tool: TavilyToolName;
  success: boolean;
  segments: TavilySegment[];
  error?: string;
  raw: unknown;
};

type RequestConfig = {
  endpoint: string;
};

const TAVILY_ENDPOINTS: Record<TavilyToolName, RequestConfig> = {
  tavily_search: { endpoint: '/search' },
  tavily_extract: { endpoint: '/extract' },
  tavily_crawl: { endpoint: '/crawl' },
  tavily_map: { endpoint: '/map' },
};

function normalizeArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0) as string[];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return undefined;
}

function sanitizeArguments(name: TavilyToolName, args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...args };

  if (name === 'tavily_search') {
    const includeDomains = normalizeArray(sanitized.include_domains);
    if (includeDomains) sanitized.include_domains = includeDomains;
    const excludeDomains = normalizeArray(sanitized.exclude_domains);
    if (excludeDomains) sanitized.exclude_domains = excludeDomains;

    ['max_results', 'days'].forEach((field) => {
      const value = coerceNumber(sanitized[field]);
      if (value !== undefined) sanitized[field] = value;
    });

    [
      'include_images',
      'include_image_descriptions',
      'include_raw_content',
      'include_favicon',
    ].forEach((field) => {
      const value = coerceBoolean(sanitized[field]);
      if (value !== undefined) sanitized[field] = value;
    });
  }

  if (name === 'tavily_extract') {
    const urls = normalizeArray(sanitized.urls);
    if (urls) sanitized.urls = urls;

    ['include_images', 'include_favicon'].forEach((field) => {
      const value = coerceBoolean(sanitized[field]);
      if (value !== undefined) sanitized[field] = value;
    });
  }

  if (name === 'tavily_crawl' || name === 'tavily_map') {
    ['max_depth', 'max_breadth', 'limit'].forEach((field) => {
      const value = coerceNumber(sanitized[field]);
      if (value !== undefined) sanitized[field] = value;
    });

    ['select_paths', 'select_domains', 'exclude_paths', 'exclude_domains'].forEach((field) => {
      const arr = normalizeArray(sanitized[field]);
      if (arr) sanitized[field] = arr;
    });

    const allowExternal = coerceBoolean(sanitized.allow_external);
    if (allowExternal !== undefined) sanitized.allow_external = allowExternal;
  }

  return sanitized;
}

function buildSummarySegments(tool: TavilyToolName, payload: unknown): TavilySegment[] {
  const segments: TavilySegment[] = [];

  if (tool === 'tavily_search' && payload && typeof payload === 'object') {
    const { answer, results } = payload as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>;
    };

    const summaryLines: string[] = [];
    if (typeof answer === 'string' && answer.trim().length > 0) {
      summaryLines.push(`Answer: ${answer.trim()}`);
    }

    if (Array.isArray(results) && results.length > 0) {
      summaryLines.push('Top results:');
      results.slice(0, 5).forEach((result) => {
        const title = result.title ?? result.url ?? 'Result';
        const url = result.url ? ` (${result.url})` : '';
        const snippet = result.snippet ?? result.content ?? '';
        const snippetText = snippet.length > 280 ? `${snippet.slice(0, 277)}...` : snippet;
        summaryLines.push(`- ${title}${url}${snippetText ? `\n  ${snippetText}` : ''}`);
      });
    }

    if (summaryLines.length > 0) {
      const summary = summaryLines.join('\n');
      segments.push({
        type: 'text',
        text: summary,
        raw: { type: 'text', text: summary },
      });
    }
  }

  segments.push({
    type: 'json',
    text: JSON.stringify(payload, null, 2),
    parsed: payload,
    raw: payload,
  });

  return segments;
}

function extractErrorMessage(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== 'object') return undefined;
  const candidate = (responseBody as { message?: unknown; error?: unknown }).message;
  if (typeof candidate === 'string') return candidate;
  const fallback = (responseBody as { error?: { message?: unknown } }).error;
  if (fallback && typeof fallback === 'object' && typeof fallback.message === 'string') {
    return fallback.message;
  }
  return undefined;
}

export async function callTavilyMcp(
  request: TavilyRequest,
  options: { signal?: AbortSignal } = {},
): Promise<TavilyResponse> {
  const config = TAVILY_ENDPOINTS[request.name];
  if (!config) {
    throw new Error(`Unsupported Tavily tool: ${request.name}`);
  }

  const apiKey = getTavilyApiKey();
  const baseUrl = getTavilyApiBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}${config.endpoint}`;

  const sanitizedArgs = sanitizeArguments(request.name, request.arguments ?? {});

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      ...sanitizedArgs,
    }),
    signal: options.signal,
  });

  let bodyJson: unknown;
  try {
    bodyJson = await response.json();
  } catch (error) {
    bodyJson = undefined;
  }

  if (!response.ok) {
    const message = extractErrorMessage(bodyJson) ?? `Tavily API request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return {
    tool: request.name,
    success: true,
    segments: buildSummarySegments(request.name, bodyJson),
    raw: bodyJson,
  };
}
