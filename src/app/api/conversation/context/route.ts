import { NextResponse } from 'next/server';
import { loadConversationState } from '@/lib/conversation/stateStore';
import { searchMemory } from '@/lib/memory/vectorStore';
import { buildContextInstructions } from '@/lib/conversation/contextBuilder';

export async function POST(request: Request) {
  let sessionId = 'primary-session';
  let focusQuery: string | undefined;

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      query?: string;
    };
    if (body?.sessionId && typeof body.sessionId === 'string') {
      sessionId = body.sessionId;
    }
    if (body?.query && typeof body.query === 'string') {
      focusQuery = body.query;
    }
  } catch (error) {
    // body optional
  }

  const state = await loadConversationState(sessionId);

  const searchTerm =
    focusQuery ??
    (state.lastSummary && state.lastSummary.length > 0 ? state.lastSummary.slice(0, 256) : 'recent highlights');

  const memories = await searchMemory(sessionId, searchTerm, 3);

  const instructions = buildContextInstructions(state, memories);

  console.info('[memory] Loaded context', {
    sessionId,
    hasSummary: Boolean(state.lastSummary),
    highlights: state.highlights?.length ?? 0,
    todos: state.todos?.length ?? 0,
    memories: memories.length,
  });

  return NextResponse.json({
    instructions,
    state,
    memories,
  });
}
