import type { ConversationState } from '@/lib/conversation/types';
import { getDatabase } from '@/lib/db/sqlite';

const db = getDatabase();

const selectStateStmt = db.prepare<[
  string
]>(
  `SELECT last_summary, highlights, todos, updated_at
   FROM conversation_state
   WHERE session_id = ?`
);

const upsertStateStmt = db.prepare<[
  string,
  string | null,
  string,
  string,
  string
]>(
  `INSERT INTO conversation_state (session_id, last_summary, highlights, todos, updated_at)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(session_id) DO UPDATE SET
     last_summary = excluded.last_summary,
     highlights = excluded.highlights,
     todos = excluded.todos,
     updated_at = excluded.updated_at`
);

function parseArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch (error) {
    return [];
  }
}

export async function loadConversationState(sessionId: string): Promise<ConversationState> {
  const row = selectStateStmt.get(sessionId) as
    | {
        last_summary: string | null;
        highlights: string | null;
        todos: string | null;
        updated_at: string | null;
      }
    | undefined;

  if (!row) {
    return {
      sessionId,
      highlights: [],
      todos: [],
    };
  }

  return {
    sessionId,
    lastSummary: row.last_summary ?? undefined,
    highlights: parseArray(row.highlights),
    todos: parseArray(row.todos),
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function saveConversationState(sessionId: string, state: ConversationState): Promise<void> {
  const updatedAt = new Date().toISOString();
  const highlightsJson = JSON.stringify(state.highlights ?? []);
  const todosJson = JSON.stringify(state.todos ?? []);

  upsertStateStmt.run(
    sessionId,
    state.lastSummary ?? null,
    highlightsJson,
    todosJson,
    updatedAt,
  );
}
