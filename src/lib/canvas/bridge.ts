import type { CanvasCommand, CanvasCommandType } from '@/lib/canvas/types';

const SUPPORTED_COMMANDS: Record<string, CanvasCommandType> = {
  canvas_update_mermaid: 'mermaid.update',
  canvas_initialize_excalidraw: 'excalidraw.initialize',
  canvas_patch_excalidraw: 'excalidraw.patch',
  canvas_request_excalidraw_operations: 'excalidraw.sync',
  canvas_append_note: 'note.append',
  canvas_set_metadata: 'metadata.set',
};

export type AgentFunctionCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export function translateFunctionCall(
  call: AgentFunctionCall,
  sessionId: string,
): CanvasCommand | null {
  const type = SUPPORTED_COMMANDS[call.name];
  if (!type) {
    return null;
  }

  const args = call.arguments;

  let payload: Record<string, unknown>;

  if (type === 'excalidraw.sync') {
    if (Array.isArray(args)) {
      payload = { operations: args } as Record<string, unknown>;
    } else if (args && typeof args === 'object') {
      payload = { ...(args as Record<string, unknown>) };
    } else {
      payload = {};
    }
  } else if (type === 'excalidraw.patch') {
    if (Array.isArray(args)) {
      payload = { operations: args } as Record<string, unknown>;
    } else if (args && typeof args === 'object' && !Array.isArray(args)) {
      const clone = { ...(args as Record<string, unknown>) };
      const operations = (clone as { operations?: unknown }).operations;
      if (!Array.isArray(operations)) {
        clone.operations = [];
      }
      payload = clone;
    } else {
      payload = { operations: [] };
    }
  } else if (args && typeof args === 'object' && !Array.isArray(args)) {
    payload = args as Record<string, unknown>;
  } else {
    payload = {};
  }

  return {
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    payload,
    issuedAt: Date.now(),
    issuedBy: 'agent',
  };
}
