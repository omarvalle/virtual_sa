export type MemoryRecord = {
  id: string;
  sessionId: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  score?: number;
};
