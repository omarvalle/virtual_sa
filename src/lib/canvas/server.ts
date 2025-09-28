import type { CanvasCommand, CanvasCommandBatch } from '@/lib/canvas/types';

const MAX_COMMANDS_PER_SESSION = 100;

type CanvasState = {
  sessions: Map<string, CanvasCommand[]>;
};

const globalState = globalThis as typeof globalThis & {
  __virtualSA__canvasState?: CanvasState;
};

function getState(): CanvasState {
  if (!globalState.__virtualSA__canvasState) {
    globalState.__virtualSA__canvasState = {
      sessions: new Map(),
    };
  }
  return globalState.__virtualSA__canvasState;
}

export function recordCanvasCommands(batch: CanvasCommandBatch) {
  const state = getState();
  const existing = state.sessions.get(batch.sessionId) ?? [];
  const next = [...existing, ...batch.commands];
  if (next.length > MAX_COMMANDS_PER_SESSION) {
    state.sessions.set(batch.sessionId, next.slice(next.length - MAX_COMMANDS_PER_SESSION));
  } else {
    state.sessions.set(batch.sessionId, next);
  }
}

export function readCanvasCommands(sessionId: string): CanvasCommand[] {
  const state = getState();
  return state.sessions.get(sessionId) ?? [];
}

export function resetCanvasCommands(sessionId: string) {
  const state = getState();
  state.sessions.delete(sessionId);
}
