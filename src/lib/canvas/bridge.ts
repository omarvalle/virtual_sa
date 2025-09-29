import type { CanvasCommand, CanvasCommandType } from '@/lib/canvas/types';

const SUPPORTED_COMMANDS: Record<string, CanvasCommandType> = {
  canvas_update_mermaid: 'mermaid.update',
  canvas_initialize_excalidraw: 'excalidraw.initialize',
  canvas_patch_excalidraw: 'excalidraw.patch',
  canvas_update_aws_diagram: 'aws.diagram.update',
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

  let payload: Record<string, unknown> = call.arguments ?? {};

  if (type === 'excalidraw.patch') {
    if (Array.isArray(call.arguments)) {
      payload = { operations: call.arguments };
    } else if (
      call.arguments &&
      typeof call.arguments === 'object' &&
      !Array.isArray(call.arguments) &&
      !('operations' in call.arguments)
    ) {
      const potentialOps = (call.arguments as Record<string, unknown>).operations;
      if (Array.isArray(potentialOps)) {
        payload = call.arguments as Record<string, unknown>;
      } else {
        payload = {
          ...(call.arguments as Record<string, unknown>),
          operations: [],
        };
      }
    }
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
