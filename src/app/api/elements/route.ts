import { NextResponse } from 'next/server';
import { applyExcalidrawOperations, getExcalidrawScene } from '@/lib/canvas/excalidrawState';
import { toElementPayload, extractSessionId } from '@/lib/canvas/mappers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') ?? 'primary-session';
  const scene = getExcalidrawScene(sessionId);
  return NextResponse.json({ success: true, sessionId, scene });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = extractSessionId(body);
    const payload = toElementPayload(body);

    const scene = applyExcalidrawOperations(sessionId, [
      {
        kind: 'add_elements',
        elements: [payload],
      },
    ]);

    return NextResponse.json({
      success: true,
      sessionId,
      element: scene.elements.find((element) => element.id === payload.id) ?? scene.elements.at(-1) ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create element.',
      },
      { status: 400 },
    );
  }
}
