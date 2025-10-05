import type { ConversationState } from '@/lib/conversation/types';
import type { MemoryRecord } from '@/lib/memory/types';

export function buildContextInstructions(
  state: ConversationState,
  memories: MemoryRecord[],
): string {
  const sections: string[] = [];

  if (state.lastSummary) {
    sections.push(`Recent summary:\n${state.lastSummary}`);
  }

  if (state.todos && state.todos.length > 0) {
    sections.push(`Outstanding tasks:\n- ${state.todos.join('\n- ')}`);
  }

  if (state.highlights && state.highlights.length > 0) {
    sections.push(`Key highlights:\n- ${state.highlights.join('\n- ')}`);
  }

  if (memories.length > 0) {
    const formatted = memories
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
      .map((memory) => `• ${memory.summary}`);
    sections.push(`Relevant history:\n${formatted.join('\n')}`);
  }

  if (sections.length === 0) {
    sections.push('No prior context available for this session. Start by clarifying the user\'s goals.');
  }

  return sections.join('\n\n');
}
