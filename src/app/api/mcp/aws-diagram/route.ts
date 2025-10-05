import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { callAwsDiagramMcp } from '@/lib/mcp/awsDiagram';
import type { AwsDiagramToolName } from '@/lib/mcp/awsDiagram';
import { getAwsDiagramMcpMode } from '@/lib/config/env';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid JSON payload.',
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json(
      {
        success: false,
        message: 'Request body must be a JSON object.',
      },
      { status: 400 },
    );
  }

  const { tool, arguments: toolArguments } = payload as {
    tool?: unknown;
    arguments?: unknown;
  };

  if (typeof tool !== 'string') {
    return NextResponse.json(
      {
        success: false,
        message: 'Request must include a tool field.',
      },
      { status: 400 },
    );
  }

  let rpcResponse: any;
  try {
    rpcResponse = await callAwsDiagramMcp(tool as AwsDiagramToolName, toolArguments as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'AWS Diagram MCP request failed.',
      },
      { status: 502 },
    );
  }

  if (!rpcResponse || typeof rpcResponse !== 'object') {
    return NextResponse.json(
      {
        success: false,
        message: 'AWS Diagram MCP returned an unexpected response.',
      },
      { status: 502 },
    );
  }

  if ('error' in rpcResponse && rpcResponse.error) {
    return NextResponse.json(
      {
        success: false,
        message: rpcResponse.error?.message ?? 'AWS Diagram MCP reported an error.',
        raw: rpcResponse,
      },
      { status: 502 },
    );
  }

  const parsed = rpcResponse;

  let diagramInfo: { status?: string; path?: string | null; message?: string; imageBase64?: string } | undefined;

  const contentEntry = parsed?.result?.content?.[0];
  if (contentEntry && typeof contentEntry.text === 'string') {
    try {
      const inner = JSON.parse(contentEntry.text);
      diagramInfo = inner;

      if (inner?.path) {
        try {
          await access(inner.path, constants.R_OK);
          const fileBuffer = await readFile(inner.path);
          diagramInfo.imageBase64 = `data:image/png;base64,${fileBuffer.toString('base64')}`;
        } catch (error) {
          console.warn('[aws-diagram] unable to read generated diagram', error);
        }
      }
    } catch (error) {
      console.warn('[aws-diagram] unable to parse inner diagram payload', error);
    }
  }

  return NextResponse.json({
    success: true,
    diagram: diagramInfo,
    raw: parsed,
    mode: getAwsDiagramMcpMode(),
  });
}
