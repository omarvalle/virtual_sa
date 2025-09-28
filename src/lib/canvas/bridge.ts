import type { CanvasCommand, CanvasCommandType } from '@/lib/canvas/types';

const SUPPORTED_COMMANDS: Record<string, CanvasCommandType> = {
  'canvas.update_mermaid': 'mermaid.update',
  'canvas.initialize_excalidraw': 'excalidraw.initialize',
  'canvas.patch_excalidraw': 'excalidraw.patch',
  'canvas.append_note': 'note.append',
  'canvas.set_metadata': 'metadata.set',
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

  return {
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    type,
    payload: call.arguments ?? {},
    issuedAt: Date.now(),
    issuedBy: 'agent',
  };
}
