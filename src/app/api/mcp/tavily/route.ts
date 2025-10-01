import { NextResponse } from 'next/server';
import { isTavilyMcpEnabled } from '@/lib/config/env';
import { callTavilyMcp, type TavilyRequest, type TavilyToolName } from '@/lib/mcp/tavily';

type IncomingPayload = {
  tool?: string;
  arguments?: Record<string, unknown>;
};

function assertArray(value: unknown, label: string): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0) as string[];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  throw new Error(`${label} must be an array of strings or a comma-separated string.`);
}

function parseRequest(payload: IncomingPayload): TavilyRequest {
  const toolName = payload.tool;
  const args = payload.arguments ?? {};

  if (!toolName || typeof toolName !== 'string') {
    throw new Error('Request must include a tool identifier.');
  }

  const castTool = toolName as TavilyToolName;

  switch (castTool) {
    case 'tavily_search': {
      const query = args.query;
      if (typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('query is required for tavily_search.');
      }

      const request: TavilyRequest = {
        name: 'tavily_search',
        arguments: {
          query,
        },
      };

      if (args.max_results !== undefined) request.arguments.max_results = args.max_results;
      if (args.search_depth !== undefined) request.arguments.search_depth = args.search_depth;
      if (args.topic !== undefined) request.arguments.topic = args.topic;
      if (args.days !== undefined) request.arguments.days = args.days;
      if (args.time_range !== undefined) request.arguments.time_range = args.time_range;
      if (args.include_images !== undefined) request.arguments.include_images = args.include_images;
      if (args.include_image_descriptions !== undefined)
        request.arguments.include_image_descriptions = args.include_image_descriptions;
      if (args.include_raw_content !== undefined) request.arguments.include_raw_content = args.include_raw_content;
      if (args.include_domains !== undefined) request.arguments.include_domains = assertArray(args.include_domains, 'include_domains');
      if (args.exclude_domains !== undefined) request.arguments.exclude_domains = assertArray(args.exclude_domains, 'exclude_domains');
      if (args.country !== undefined) request.arguments.country = args.country;
      if (args.include_favicon !== undefined) request.arguments.include_favicon = args.include_favicon;
      if (args.start_date !== undefined) request.arguments.start_date = args.start_date;
      if (args.end_date !== undefined) request.arguments.end_date = args.end_date;

      return request;
    }

    case 'tavily_extract': {
      const urls = args.urls;
      if (!urls) {
        throw new Error('urls is required for tavily_extract.');
      }

      const request: TavilyRequest = {
        name: 'tavily_extract',
        arguments: {
          urls: assertArray(urls, 'urls'),
        },
      };

      if (args.extract_depth !== undefined) request.arguments.extract_depth = args.extract_depth;
      if (args.include_images !== undefined) request.arguments.include_images = args.include_images;
      if (args.format !== undefined) request.arguments.format = args.format;
      if (args.include_favicon !== undefined) request.arguments.include_favicon = args.include_favicon;

      return request;
    }

    case 'tavily_crawl':
    case 'tavily_map': {
      const url = args.url;
      if (typeof url !== 'string' || url.trim().length === 0) {
        throw new Error('url is required for Tavily crawl/map tools.');
      }

      const request: TavilyRequest = {
        name: castTool,
        arguments: {
          url,
        },
      };

      [
        'max_depth',
        'max_breadth',
        'limit',
        'instructions',
        'allow_external',
      ].forEach((field) => {
        if (args[field] !== undefined) {
          request.arguments[field] = args[field] as unknown;
        }
      });

      ['select_paths', 'select_domains', 'exclude_paths', 'exclude_domains'].forEach((field) => {
        if (args[field] !== undefined) {
          request.arguments[field] = assertArray(args[field], field);
        }
      });

      return request;
    }

    default:
      throw new Error(`Unsupported Tavily tool '${toolName}'.`);
  }
}

export async function POST(request: Request) {
  if (!isTavilyMcpEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Tavily MCP integration is not enabled. Provide TAVILY_API_KEY or TAVILY_MCP_LINK to enable it.',
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

  let tavilyRequest: TavilyRequest;

  try {
    tavilyRequest = parseRequest(payload);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to parse Tavily request.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await callTavilyMcp(tavilyRequest);
    return NextResponse.json({ success: result.success, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Tavily MCP request failed.',
      },
      { status: 502 },
    );
  }
}
