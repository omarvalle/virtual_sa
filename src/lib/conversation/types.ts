export type TranscriptTurn = {
  speaker: 'user' | 'assistant';
  text: string;
  timestamp?: number;
};

export type ConversationState = {
  sessionId: string;
  lastSummary?: string;
  highlights?: string[];
  todos?: string[];
  updatedAt?: string;
};
