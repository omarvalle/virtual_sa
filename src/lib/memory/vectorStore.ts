import { randomUUID } from 'crypto';
import { getDatabase, isVectorSearchEnabled } from '@/lib/db/sqlite';
import { createEmbedding } from '@/lib/conversation/summarizer';
import type { MemoryRecord } from '@/lib/memory/types';

const db = getDatabase();
const vecEnabled = isVectorSearchEnabled();

const insertMemoryStmt = db.prepare<[
  string,
  string,
  string,
  string,
  string,
  string | null,
]>(
  `INSERT INTO memory_summary (id, session_id, summary, embedding_json, created_at, metadata)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     session_id = excluded.session_id,
     summary = excluded.summary,
     embedding_json = excluded.embedding_json,
     created_at = excluded.created_at,
     metadata = excluded.metadata`
);

let insertVectorStmt: ReturnType<typeof db.prepare<[string, string]>> | undefined;
let deleteVectorStmt: ReturnType<typeof db.prepare<[string]>> | undefined;
let vectorQueryStmt: ReturnType<typeof db.prepare<[string, string, number]>> | undefined;

if (vecEnabled) {
  try {
    insertVectorStmt = db.prepare<[string, string]>(
      `INSERT INTO memory_summary_vec (id, embedding)
       VALUES (?, vec_f32(?))`
    );

    deleteVectorStmt = db.prepare<[string]>(
      `DELETE FROM memory_summary_vec WHERE id = ?`
    );

    vectorQueryStmt = db.prepare<[string, string, number]>(
      `SELECT ms.id,
              ms.session_id,
              ms.summary,
              ms.created_at,
              ms.metadata,
              memory_summary_vec.distance AS distance
       FROM memory_summary_vec
       JOIN memory_summary AS ms ON ms.id = memory_summary_vec.id
       WHERE ms.session_id = ?
         AND memory_summary_vec.embedding MATCH vec_f32(?)
       ORDER BY memory_summary_vec.distance
       LIMIT ?`
    );
  } catch (error) {
    console.warn('[memory] sqlite-vec JSON helpers not available; disabling vector search.', error);
    insertVectorStmt = undefined;
    deleteVectorStmt = undefined;
    vectorQueryStmt = undefined;
  }
}

const selectSessionSummariesStmt = db.prepare<[string]>(
  `SELECT id, session_id, summary, embedding_json, created_at, metadata
   FROM memory_summary
   WHERE session_id = ?`
);

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseEmbedding(json: string): number[] {
  try {
    const parsed = JSON.parse(json) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function storeMemory(
  sessionId: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const id = `mem_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  let embedding: number[] = [];
  try {
    embedding = await createEmbedding(summary);
  } catch (error) {
    console.warn('[memory] Unable to create embedding; storing summary without vector.', error);
  }
  const embeddingJson = JSON.stringify(embedding);
  const metadataJson = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

  insertMemoryStmt.run(id, sessionId, summary, embeddingJson, createdAt, metadataJson);

  if (vecEnabled && insertVectorStmt && deleteVectorStmt && embedding.length === 1536) {
    try {
      deleteVectorStmt.run(id);
      insertVectorStmt.run(id, embeddingJson);
    } catch (error) {
      console.warn('[memory] Failed to upsert vector embedding; falling back to cosine search.', error);
    }
  } else if (vecEnabled && embedding.length !== 1536) {
    console.warn('[memory] Embedding length mismatch; skipping vector index entry.');
  }

  return id;
}

export async function searchMemory(
  sessionId: string,
  query: string,
  topK = 3,
): Promise<MemoryRecord[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const embedding = await createEmbedding(query);
  const embeddingJson = JSON.stringify(embedding);

  if (vecEnabled && vectorQueryStmt) {
    const rows = vectorQueryStmt.all(sessionId, embeddingJson, topK) as Array<{
      id: string;
      session_id: string;
      summary: string;
      created_at: string;
      metadata?: string;
      distance?: number;
    }>;

    if (rows.length === 0) {
      // Fallback to recency when the vector index returns nothing.
      const recents = selectSessionSummariesStmt.all(sessionId) as Array<{
        id: string;
        session_id: string;
        summary: string;
        created_at: string;
        metadata?: string;
      }>;

      return recents
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
        .slice(0, topK)
        .map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          summary: row.summary,
          createdAt: row.created_at,
          metadata: row.metadata ? safeParseJson(row.metadata) : undefined,
        }));
    }

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      summary: row.summary,
      createdAt: row.created_at,
      metadata: row.metadata ? safeParseJson(row.metadata) : undefined,
      score: typeof row.distance === 'number' ? 1 / (1 + row.distance) : undefined,
    }));
  }

  const rows = selectSessionSummariesStmt.all(sessionId) as Array<{
    id: string;
    session_id: string;
    summary: string;
    embedding_json: string;
    created_at: string;
    metadata?: string;
  }>;

  const similarities = rows
    .map((row) => {
      const candidateEmbedding = parseEmbedding(row.embedding_json);
      const similarity = cosineSimilarity(embedding, candidateEmbedding);
      return {
        row,
        similarity,
      };
    })
    .filter(({ similarity }) => similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  const selected = similarities.length > 0
    ? similarities
    : rows
        .map((row) => ({ row, similarity: 0 }))
        .sort((a, b) => (a.row.created_at > b.row.created_at ? -1 : 1))
        .slice(0, topK);

  return selected.map(({ row, similarity }) => ({
    id: row.id,
    sessionId: row.session_id,
    summary: row.summary,
    createdAt: row.created_at,
    metadata: row.metadata ? safeParseJson(row.metadata) : undefined,
    score: similarity > 0 ? similarity : undefined,
  }));
}

function safeParseJson(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch (error) {
    return undefined;
  }
}
