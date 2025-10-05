import { generateConversationSummary } from '@/lib/conversation/summarizer';
import { loadConversationState, saveConversationState } from '@/lib/conversation/stateStore';
import { storeMemory } from '@/lib/memory/vectorStore';
import type { TranscriptTurn } from '@/lib/conversation/types';

function buildFallbackSummary(turns: TranscriptTurn[]) {
  const summaryText = turns
    .slice(-6)
    .map((turn) => `${turn.speaker === 'assistant' ? 'Assistant' : 'User'}: ${turn.text}`)
    .join('\n')
    .slice(0, 600);

  const highlights = turns
    .filter((turn) => turn.speaker === 'assistant')
    .slice(-3)
    .map((turn) => turn.text.slice(0, 160));

  const todos = turns
    .filter((turn) => /todo|task|next/i.test(turn.text))
    .slice(-3)
    .map((turn) => turn.text.slice(0, 160));

  return {
    summary: summaryText || 'Conversation summary unavailable.',
    highlights,
    todos,
  };
}

export async function processConversationTranscript(
  sessionId: string,
  turns: TranscriptTurn[],
) {
  if (turns.length === 0) {
    return { summary: '', highlights: [], todos: [] };
  }

  let summary;
  try {
    summary = await generateConversationSummary(turns);
  } catch (error) {
    console.warn('[memory] Falling back to local summary generation:', error);
    summary = buildFallbackSummary(turns);
  }

  const state = await loadConversationState(sessionId);
  state.lastSummary = summary.summary;
  state.highlights = summary.highlights;
  state.todos = summary.todos;

  await saveConversationState(sessionId, state);

  const memoryText = [summary.summary, ...summary.highlights, ...summary.todos]
    .filter(Boolean)
    .join('\n');

  if (memoryText.trim().length > 0) {
    await storeMemory(sessionId, memoryText, {
      summary: summary.summary,
      highlights: summary.highlights,
      todos: summary.todos,
    });
  }

  return summary;
}
