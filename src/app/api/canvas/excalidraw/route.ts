import { NextResponse } from 'next/server';
import { getExcalidrawScene, resetExcalidrawScene } from '@/lib/canvas/excalidrawState';

function parseSessionId(url: string): string {
  const { searchParams } = new URL(url);
  return searchParams.get('sessionId') ?? 'primary-session';
}

export async function GET(request: Request) {
  const sessionId = parseSessionId(request.url);
  const scene = getExcalidrawScene(sessionId);
  return NextResponse.json({ sessionId, scene });
}

export async function DELETE(request: Request) {
  const sessionId = parseSessionId(request.url);
  resetExcalidrawScene(sessionId);
  return NextResponse.json({ sessionId, cleared: true });
}
