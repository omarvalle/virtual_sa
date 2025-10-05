import { NextResponse } from 'next/server';
import { processConversationTranscript } from '@/lib/conversation/processor';
import type { TranscriptTurn } from '@/lib/conversation/types';

export async function POST(request: Request) {
  let body: { sessionId?: string; transcripts?: TranscriptTurn[] };

  try {
    body = (await request.json()) as { sessionId?: string; transcripts?: TranscriptTurn[] };
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : 'primary-session';
  const transcripts = Array.isArray(body.transcripts) ? body.transcripts : [];

  if (transcripts.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'No transcripts provided for summarization.',
      },
      { status: 400 },
    );
  }

  try {
    const summary = await processConversationTranscript(sessionId, transcripts);
    console.info('[memory] Stored conversation summary', {
      sessionId,
      highlights: summary.highlights?.length ?? 0,
      todos: summary.todos?.length ?? 0,
    });
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[memory] Failed to process conversation transcript', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to summarize conversation.',
      },
      { status: 500 },
    );
  }
}
