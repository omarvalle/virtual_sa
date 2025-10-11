import { NextResponse } from 'next/server';
import { saveScreenshotAsset } from '@/lib/assets/screenshots';
import { getPublicAppUrl } from '@/lib/config/env';

type ScreenshotRequestBody = {
  sessionId?: string;
  imageBase64?: string;
  mimeType?: string;
  capturedAt?: string;
  description?: string;
  source?: string;
};

export async function POST(request: Request) {
  let body: ScreenshotRequestBody;
  try {
    body = (await request.json()) as ScreenshotRequestBody;
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : '';

  if (!sessionId) {
    return NextResponse.json({ success: false, message: 'sessionId is required.' }, { status: 400 });
  }
  if (!imageBase64) {
    return NextResponse.json({ success: false, message: 'imageBase64 is required.' }, { status: 400 });
  }
  if (!mimeType) {
    return NextResponse.json({ success: false, message: 'mimeType is required.' }, { status: 400 });
  }

  try {
    const asset = await saveScreenshotAsset({
      sessionId,
      imageBase64,
      mimeType,
      capturedAt: body.capturedAt,
      description: body.description,
      source: body.source,
    });

    const publicBase = getPublicAppUrl() ?? new URL(request.url).origin;
    const publicPath = asset.path.replace(/^screenshots\//, '');
    const publicUrl = new URL(`/api/screenshots/${publicPath}`, publicBase).toString();

    return NextResponse.json({ success: true, asset, publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist screenshot frame.';
    const status = message.toLowerCase().includes('unsupported') ? 400 : 500;
    console.error('[screenshots] Unable to persist frame:', error);
    return NextResponse.json({ success: false, message }, { status });
  }
}
