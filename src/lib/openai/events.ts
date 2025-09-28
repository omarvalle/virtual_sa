import type { CanvasCommand } from '@/lib/canvas/types';
import { translateFunctionCall } from '@/lib/canvas/bridge';

export type RealtimeEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

export type RealtimeEventHandlers = {
  onTranscriptionDelta?: (itemId: string, textDelta: string) => void;
  onTranscriptionComplete?: (itemId: string) => void;
  onResponseDelta?: (responseId: string, textDelta: string) => void;
  onResponseCompleted?: (responseId: string) => void;
  onFunctionCall?: (command: CanvasCommand) => void;
  onDebugEvent?: (event: RealtimeEvent) => void;
};

export function parseRealtimeEvent(
  raw: string,
  sessionId: string,
  handlers: RealtimeEventHandlers,
) {
  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    handlers.onDebugEvent?.({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'parse_error',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown parse error',
        raw,
      },
    });
    return;
  }

  const type = parsed?.type ?? 'unknown';
  const eventId = parsed?.event_id ?? `evt_${Date.now()}`;

  handlers.onDebugEvent?.({
    id: eventId,
    type,
    payload: parsed,
  });

  switch (type) {
    case 'conversation.item.input_audio_transcription.delta': {
      const itemId = parsed?.item?.id ?? parsed?.item_id;
      if (itemId && typeof parsed?.delta?.text === 'string') {
        handlers.onTranscriptionDelta?.(itemId, parsed.delta.text);
      }
      break;
    }
    case 'conversation.item.input_audio_transcription.completed': {
      const itemId = parsed?.item?.id ?? parsed?.item_id;
      if (itemId) {
        handlers.onTranscriptionComplete?.(itemId);
      }
      break;
    }
    case 'response.output_text.delta': {
      const responseId = parsed?.response?.id ?? parsed?.response_id;
      if (responseId && typeof parsed?.delta === 'string') {
        handlers.onResponseDelta?.(responseId, parsed.delta);
      }
      break;
    }
    case 'response.output_text.done':
    case 'response.completed': {
      const responseId = parsed?.response?.id ?? parsed?.response_id;
      if (responseId) {
        handlers.onResponseCompleted?.(responseId);
      }
      break;
    }
    case 'response.function_call_arguments.delta': {
      const responseId = parsed?.response?.id ?? parsed?.response_id;
      const callName = parsed?.name ?? parsed?.response?.output?.[0]?.content?.[0]?.name;
      const argumentDelta = parsed?.arguments_delta;
      if (responseId && callName && typeof argumentDelta === 'string') {
        handlers.onResponseDelta?.(responseId, argumentDelta);
      }
      break;
    }
    case 'response.function_call_arguments.done': {
      const responseId = parsed?.response?.id ?? parsed?.response_id;
      const callName = parsed?.name ?? parsed?.response?.output?.[0]?.content?.[0]?.name;
      const args = parsed?.arguments ?? parsed?.response?.output?.[0]?.content?.[0]?.arguments;
      if (responseId && callName && typeof args === 'string') {
        try {
          const parsedArgs = JSON.parse(args);
          const command = translateFunctionCall({ name: callName, arguments: parsedArgs }, sessionId);
          if (command) {
            handlers.onFunctionCall?.(command);
          }
        } catch (error) {
          handlers.onDebugEvent?.({
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'function_call_parse_error',
            payload: {
              callName,
              args,
              error: error instanceof Error ? error.message : 'Unknown parse error',
            },
          });
        }
      }
      break;
    }
    default:
      break;
  }
}
