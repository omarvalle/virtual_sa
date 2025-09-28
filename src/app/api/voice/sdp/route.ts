import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCsvEnv } from '@/lib/config/env';

const allowedOrigins = getCsvEnv('VOICE_TOKEN_ALLOWED_ORIGINS').map((origin) => origin.toLowerCase());

function isOriginAllowed(originHeader: string | null): boolean {
  if (allowedOrigins.length === 0) {
    return true;
  }

  if (!originHeader) {
    return false;
  }

  return allowedOrigins.includes(originHeader.toLowerCase());
}

export async function POST(request: Request) {
  const origin = headers().get('origin');

  if (!isOriginAllowed(origin)) {
    return NextResponse.json(
      {
        message: 'Origin not allowed to perform SDP exchange.',
      },
      { status: 403 },
    );
  }

  let body: { clientSecret?: string; realtimeUrl?: string; sdp?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { clientSecret, realtimeUrl, sdp } = body;

  if (!clientSecret || !realtimeUrl || !sdp) {
    return NextResponse.json(
      { message: 'Missing clientSecret, realtimeUrl, or sdp in request.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(realtimeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: sdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Realtime SDP exchange failed: ${response.status} ${errorText}`);
    }

    const answerSdp = await response.text();

    return NextResponse.json({ answer: answerSdp });
  } catch (error) {
    console.error('Realtime SDP exchange error', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Realtime negotiation failed.',
      },
      { status: 502 },
    );
  }
}
