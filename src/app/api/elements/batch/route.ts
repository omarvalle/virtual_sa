import { NextResponse } from 'next/server';
import { applyExcalidrawOperations } from '@/lib/canvas/excalidrawState';
import { extractSessionId, toElementPayload } from '@/lib/canvas/mappers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = extractSessionId(body);
    const rawElements = Array.isArray(body.elements) ? body.elements : [];

    if (rawElements.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Batch requires at least one element.',
        },
        { status: 400 },
      );
    }

    const payloads = rawElements
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((element) => toElementPayload(element));

    const scene = applyExcalidrawOperations(sessionId, [
      {
        kind: 'add_elements',
        elements: payloads,
      },
    ]);

    return NextResponse.json({
      success: true,
      sessionId,
      elements: scene.elements.filter((element) => payloads.some((payload) => payload.id === element.id)),
      count: payloads.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create elements batch.',
      },
      { status: 400 },
    );
  }
}
