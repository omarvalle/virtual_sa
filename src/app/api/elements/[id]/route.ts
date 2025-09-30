import { NextResponse } from 'next/server';
import { applyExcalidrawOperations, getExcalidrawScene } from '@/lib/canvas/excalidrawState';
import { toElementPayload, extractSessionId, toElementProps } from '@/lib/canvas/mappers';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') ?? 'primary-session';
  const scene = getExcalidrawScene(sessionId);
  const element = scene.elements.find((item) => item.id === params.id) ?? null;
  return NextResponse.json({ success: true, sessionId, element });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = extractSessionId(body);
    const props = toElementProps({ ...body, id: params.id });

    const scene = applyExcalidrawOperations(sessionId, [
      {
        kind: 'update_element',
        id: params.id,
        props,
      },
    ]);

    const element = scene.elements.find((item) => item.id === params.id) ?? null;
    return NextResponse.json({ success: true, sessionId, element });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update element.',
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') ?? 'primary-session';

  applyExcalidrawOperations(sessionId, [
    {
      kind: 'remove_element',
      id: params.id,
    },
  ]);

  return NextResponse.json({ success: true, sessionId, removedId: params.id });
}
