import { NextResponse } from 'next/server';
import { isAwsKnowledgeMcpEnabled } from '@/lib/config/env';
import { callAwsKnowledge, type AwsKnowledgeRequest } from '@/lib/mcp/awsKnowledge';

type IncomingPayload = {
  tool?: string;
  arguments?: Record<string, unknown>;
};

function parseRequest(payload: IncomingPayload): AwsKnowledgeRequest {
  const toolName = payload.tool;
  const args = payload.arguments ?? {};

  if (!toolName || typeof toolName !== 'string') {
    throw new Error('Request must include a tool identifier.');
  }

  switch (toolName) {
    case 'aws_knowledge_search': {
      const searchPhrase = args.search_phrase;
      if (typeof searchPhrase !== 'string' || searchPhrase.trim().length === 0) {
        throw new Error('search_phrase is required for aws_knowledge_search.');
      }
      const limit = args.limit;
      return {
        tool: 'search',
        arguments: {
          search_phrase: searchPhrase,
          ...(typeof limit === 'number' || typeof limit === 'string' ? { limit: Number(limit) } : {}),
        },
      };
    }

    case 'aws_knowledge_read': {
      const url = args.url;
      if (typeof url !== 'string' || url.trim().length === 0) {
        throw new Error('url is required for aws_knowledge_read.');
      }
      const request: AwsKnowledgeRequest = {
        tool: 'read',
        arguments: {
          url,
        },
      };
      if (args.start_index !== undefined) {
        const start = Number(args.start_index);
        if (Number.isFinite(start)) {
          request.arguments.start_index = start;
        }
      }
      if (args.max_length !== undefined) {
        const max = Number(args.max_length);
        if (Number.isFinite(max)) {
          request.arguments.max_length = max;
        }
      }
      return request;
    }

    case 'aws_knowledge_recommend': {
      const url = args.url;
      if (typeof url !== 'string' || url.trim().length === 0) {
        throw new Error('url is required for aws_knowledge_recommend.');
      }
      return {
        tool: 'recommend',
        arguments: { url },
      };
    }

    default:
      throw new Error(`Unsupported AWS Knowledge tool '${toolName}'.`);
  }
}

export async function POST(request: Request) {
  if (!isAwsKnowledgeMcpEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'AWS Knowledge MCP integration is not enabled. Set AWS_KNOWLEDGE_MCP_ENABLED=true.',
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

  let awsRequest: AwsKnowledgeRequest;

  try {
    awsRequest = parseRequest(payload);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to parse request.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await callAwsKnowledge(awsRequest);
    return NextResponse.json({ success: result.success, result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'AWS Knowledge MCP request failed.',
      },
      { status: 502 },
    );
  }
}
