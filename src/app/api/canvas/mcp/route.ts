import { NextResponse } from 'next/server';
import { callExcalidrawMcp } from '@/lib/openai/mcpClient';
import type { McpOperation } from '@/lib/openai/mcpClient';
import { isExcalidrawMcpEnabled } from '@/lib/config/env';

export async function POST(request: Request) {
  if (!isExcalidrawMcpEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Excalidraw MCP integration is not enabled. Set EXCALIDRAW_MCP_ENABLED=true.',
      },
      { status: 400 },
    );
  }

  let body: { operation?: unknown; payload?: unknown };

  try {
    body = (await request.json()) as { operation?: unknown; payload?: unknown };
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

  const operation = typeof body.operation === 'string' ? (body.operation as McpOperation) : undefined;
  const payload = (body.payload && typeof body.payload === 'object') ? (body.payload as Record<string, unknown>) : {};

  if (!operation) {
    return NextResponse.json(
      {
        success: false,
        message: 'Request must include an operation field.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await callExcalidrawMcp(operation, payload);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Excalidraw MCP request failed.',
      },
      { status: 502 },
    );
  }
}
