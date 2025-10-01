import { getTavilyMcpUrl } from '@/lib/config/env';

export type TavilyToolName = 'tavily_search' | 'tavily_extract' | 'tavily_crawl' | 'tavily_map';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: {
    name: TavilyToolName;
    arguments: Record<string, unknown>;
  };
};

type JsonRpcSuccess<T> = {
  jsonrpc: '2.0';
  id?: string;
  result: T;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id?: string;
  error: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type TavilyToolContent = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

type TavilyToolCallResult = {
  content?: TavilyToolContent[];
  isError?: boolean;
};

export type TavilyRequest = {
  name: TavilyToolName;
  arguments: Record<string, unknown>;
};

export type TavilySegment = {
  type: string;
  text?: string;
  parsed?: unknown;
  raw: TavilyToolContent;
};

export type TavilyResponse = {
  tool: TavilyToolName;
  success: boolean;
  segments: TavilySegment[];
  error?: string;
  raw: unknown;
};

function sanitizeRequestArgs(name: TavilyToolName, args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...args };

  if (name === 'tavily_search') {
    if (typeof sanitized.max_results === 'string') {
      const parsed = Number.parseInt(sanitized.max_results, 10);
      if (!Number.isNaN(parsed)) sanitized.max_results = parsed;
    }
    if (typeof sanitized.days === 'string') {
      const parsed = Number.parseInt(sanitized.days, 10);
      if (!Number.isNaN(parsed)) sanitized.days = parsed;
    }
    if (sanitized.include_domains && typeof sanitized.include_domains === 'string') {
      sanitized.include_domains = sanitized.include_domains
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
    if (sanitized.exclude_domains && typeof sanitized.exclude_domains === 'string') {
      sanitized.exclude_domains = sanitized.exclude_domains
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  if (name === 'tavily_extract') {
    if (typeof sanitized.urls === 'string') {
      sanitized.urls = sanitized.urls
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  if (name === 'tavily_crawl' || name === 'tavily_map') {
    ['max_depth', 'max_breadth', 'limit'].forEach((key) => {
      if (typeof sanitized[key] === 'string') {
        const parsed = Number.parseInt(sanitized[key] as string, 10);
        if (!Number.isNaN(parsed)) sanitized[key] = parsed;
      }
    });

    ['select_paths', 'select_domains', 'exclude_paths', 'exclude_domains'].forEach((key) => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = (sanitized[key] as string)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
      }
    });
  }

  return sanitized;
}

function parseSsePayload(body: string): unknown {
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    throw new Error('Unexpected Tavily MCP response: missing data payload.');
  }

  const lastPayload = dataLines[dataLines.length - 1];
  return JSON.parse(lastPayload);
}

function safeParseJson(value?: string): unknown | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    return undefined;
  }
}

export async function callTavilyMcp(
  request: TavilyRequest,
  options: { signal?: AbortSignal } = {},
): Promise<TavilyResponse> {
  const url = getTavilyMcpUrl();
  const payload: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    method: 'tools/call',
    params: {
      name: request.name,
      arguments: sanitizeRequestArgs(request.name, request.arguments),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Tavily MCP request failed: ${response.status} ${response.statusText} ${bodyText}`);
  }

  const parsed = parseSsePayload(bodyText) as JsonRpcSuccess<TavilyToolCallResult> | JsonRpcError;

  if ('error' in parsed) {
    throw new Error(parsed.error?.message ?? 'Tavily MCP request failed.');
  }

  const result = parsed.result ?? {};
  const segments: TavilySegment[] = Array.isArray(result.content)
    ? result.content.map((segment) => ({
        type: segment.type,
        text: typeof segment.text === 'string' ? segment.text : undefined,
        parsed: safeParseJson(typeof segment.text === 'string' ? segment.text : undefined),
        raw: segment,
      }))
    : [];

  const isError = Boolean(result.isError);
  const errorText =
    isError && segments.length > 0 && typeof segments[0].text === 'string'
      ? segments[0].text
      : undefined;

  return {
    tool: request.name,
    success: !isError,
    segments,
    error: isError ? errorText ?? 'Tavily MCP reported an error.' : undefined,
    raw: parsed,
  };
}
