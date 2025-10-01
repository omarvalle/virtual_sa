import { getAwsKnowledgeMcpUrl } from '@/lib/config/env';

type AwsKnowledgeTool = 'search' | 'read' | 'recommend';

const TOOL_NAME_MAP: Record<AwsKnowledgeTool, string> = {
  search: 'aws___search_documentation',
  read: 'aws___read_documentation',
  recommend: 'aws___recommend',
};

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: Record<string, unknown>;
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

type AwsKnowledgeToolCallResult = {
  isError?: boolean;
  content?: Array<{
    type: string;
    text?: string;
  }>;
};

export type AwsKnowledgeRequest =
  | {
      tool: 'search';
      arguments: {
        search_phrase: string;
        limit?: number;
      };
    }
  | {
      tool: 'read';
      arguments: {
        url: string;
        start_index?: number;
        max_length?: number;
      };
    }
  | {
      tool: 'recommend';
      arguments: {
        url: string;
      };
    };

export type AwsKnowledgeSegment = {
  type: string;
  text?: string;
  parsed?: unknown;
};

export type AwsKnowledgeResponse = {
  tool: AwsKnowledgeRequest['tool'];
  success: boolean;
  segments: AwsKnowledgeSegment[];
  error?: string;
  raw: unknown;
};

function sanitizeArguments(request: AwsKnowledgeRequest): Record<string, unknown> {
  const args = { ...request.arguments } as Record<string, unknown>;

  if ('limit' in args && args.limit !== undefined) {
    args.limit = Number(args.limit);
  }

  if ('start_index' in args && args.start_index !== undefined) {
    args.start_index = Number(args.start_index);
  }

  if ('max_length' in args && args.max_length !== undefined) {
    args.max_length = Number(args.max_length);
  }

  return args;
}

function safeParse(text?: string): unknown | undefined {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

export async function callAwsKnowledge(
  request: AwsKnowledgeRequest,
  options: { signal?: AbortSignal } = {},
): Promise<AwsKnowledgeResponse> {
  const url = getAwsKnowledgeMcpUrl();
  const rpcRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    method: 'tools/call',
    params: {
      name: TOOL_NAME_MAP[request.tool],
      arguments: sanitizeArguments(request),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcRequest),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AWS Knowledge MCP request failed: ${response.status} ${response.statusText} ${text}`);
  }

  const body = (await response.json()) as JsonRpcSuccess<AwsKnowledgeToolCallResult> | JsonRpcError;

  if ('error' in body) {
    throw new Error(body.error?.message ?? 'AWS Knowledge MCP request failed');
  }

  const toolResult = body.result ?? {};
  const segments: AwsKnowledgeSegment[] = Array.isArray(toolResult.content)
    ? toolResult.content.map((segment) => ({
        type: segment.type,
        text: segment.text,
        parsed: safeParse(segment.text),
      }))
    : [];

  const structuredError = !toolResult || toolResult.isError;

  return {
    tool: request.tool,
    success: !structuredError,
    segments,
    error: structuredError ? 'AWS Knowledge MCP reported an error.' : undefined,
    raw: body,
  };
}
