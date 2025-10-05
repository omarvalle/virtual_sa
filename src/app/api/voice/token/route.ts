import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createOpenAIRealtimeSession } from '@/lib/openai/server';
import { assertRequiredEnv, getCsvEnv } from '@/lib/config/env';

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
        message: 'Origin not allowed to request voice session tokens.',
      },
      { status: 403 },
    );
  }

  try {
    assertRequiredEnv();
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Environment not configured.',
      },
      { status: 500 },
    );
  }

  try {
    let additionalInstructions: string | undefined;

    try {
      const body = (await request.json()) as { instructions?: string };
      if (body && typeof body.instructions === 'string' && body.instructions.trim().length > 0) {
        additionalInstructions = body.instructions;
      }
    } catch (error) {
      // Body is optional; ignore parsing errors and fall back to defaults.
    }

    const session = await createOpenAIRealtimeSession({ additionalInstructions });

    console.info('Issued OpenAI realtime session token');

    return NextResponse.json({
      clientSecret: session.clientSecret,
      realtimeUrl: session.realtimeUrl,
    });
  } catch (error) {
    console.error('Failed to obtain realtime session token', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create OpenAI realtime session.',
      },
      { status: 502 },
    );
  }
}
