import { NextResponse } from 'next/server';
import { readCanvasCommands, recordCanvasCommands, resetCanvasCommands } from '@/lib/canvas/server';
import type { CanvasCommandBatch } from '@/lib/canvas/types';

function parseSessionId(url: string): string {
  const { searchParams } = new URL(url);
  return searchParams.get('sessionId') ?? 'primary-session';
}

export async function GET(request: Request) {
  const sessionId = parseSessionId(request.url);
  const commands = readCanvasCommands(sessionId);
  return NextResponse.json({ sessionId, commands });
}

export async function DELETE(request: Request) {
  const sessionId = parseSessionId(request.url);
  resetCanvasCommands(sessionId);
  return NextResponse.json({ sessionId, cleared: true });
}

export async function POST(request: Request) {
  let payload: CanvasCommandBatch;

  try {
    payload = (await request.json()) as CanvasCommandBatch;
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Invalid JSON payload',
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }

  if (!payload?.sessionId || !Array.isArray(payload.commands)) {
    return NextResponse.json(
      { message: 'Request must include sessionId and an array of commands.' },
      { status: 400 },
    );
  }

  recordCanvasCommands(payload);

  return NextResponse.json({
    sessionId: payload.sessionId,
    accepted: payload.commands.length,
  });
}
