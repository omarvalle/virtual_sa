'use client';

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { VoiceSessionHandles } from '@/lib/openai/realtimeClient';
import { createRealtimeSession } from '@/lib/openai/realtimeClient';
import { postCanvasCommands } from '@/lib/canvas/client';
import type { TranscriptLine, VoiceDebugEvent } from '@/components/voice/VoiceEventLog';
import { VoiceEventLog } from '@/components/voice/VoiceEventLog';
import { parseRealtimeEvent } from '@/lib/openai/events';

const panelStyles: CSSProperties = {
  padding: '1.5rem',
  borderRadius: '1rem',
  background: '#1e293b',
};

const MAX_EVENTS = 50;
const SESSION_ID = 'primary-session';

function randomId(fallback?: string) {
  if (fallback) return fallback;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type TranscriptBuffer = {
  role: TranscriptLine['speaker'];
  text: string;
};

export function VoiceSessionPanel() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionHandles, setSessionHandles] = useState<VoiceSessionHandles | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const responseBuffer = useRef<Map<string, TranscriptBuffer>>(new Map());
  const userBuffer = useRef<Map<string, TranscriptBuffer>>(new Map());
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [events, setEvents] = useState<VoiceDebugEvent[]>([]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Negotiating secure connection…';
      case 'active':
        return 'Live session active';
      case 'error':
        return 'Unable to connect';
      default:
        return 'Session idle';
    }
  }, [status]);

  const appendEvent = useCallback((event: VoiceDebugEvent) => {
    setEvents((prev) => {
      const next = [...prev, event];
      if (next.length > MAX_EVENTS) {
        return next.slice(next.length - MAX_EVENTS);
      }
      return next;
    });
  }, []);

  const finalizeTranscript = useCallback((id: string, source: 'assistant' | 'user') => {
    const bufferStore = source === 'assistant' ? responseBuffer.current : userBuffer.current;
    const buffer = bufferStore.get(id);

    if (buffer && buffer.text.trim().length > 0) {
      setTranscripts((prev) => [...prev, { id, speaker: buffer.role, text: buffer.text.trim() }]);
    }

    bufferStore.delete(id);
  }, []);

  const upsertBuffer = useCallback(
    (
      store: Map<string, TranscriptBuffer>,
      id: string,
      role: TranscriptLine['speaker'],
      textChunk: string,
    ) => {
      const current = store.get(id) ?? { role, text: '' };
      current.text += textChunk;
      store.set(id, current);
    },
    [],
  );

  const safeDeltaString = (delta: unknown): string => {
    if (typeof delta === 'string') {
      return delta;
    }
    if (Array.isArray(delta)) {
      return delta.join('');
    }
    if (typeof delta === 'object' && delta !== null && 'text' in delta) {
      const value = (delta as { text?: string | string[] }).text;
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join('');
    }
    return '';
  };

  const handleControlMessage = useCallback(
    (event: MessageEvent<string>) => {
      parseRealtimeEvent(event.data, SESSION_ID, {
        onDebugEvent: ({ id, type, payload }) => {
          appendEvent({
            id,
            type,
            label: JSON.stringify(payload, null, 2),
            timestamp: Date.now(),
          });
        },
        onTranscriptionDelta: (itemId, delta) => {
          upsertBuffer(userBuffer.current, itemId, 'user', delta);
        },
        onTranscriptionComplete: (itemId) => {
          finalizeTranscript(itemId, 'user');
        },
        onResponseDelta: (responseId, delta) => {
          upsertBuffer(responseBuffer.current, responseId, 'assistant', delta);
        },
        onResponseCompleted: (responseId) => {
          finalizeTranscript(responseId, 'assistant');
        },
        onFunctionCall: async (command) => {
          try {
            if (command.type === 'excalidraw.sync') {
              const response = await fetch('/api/canvas/mcp', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(command.payload ?? {}),
              });

              if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.message ?? 'MCP request failed.');
              }

              const body = (await response.json()) as { success: boolean; result?: unknown };

              appendEvent({
                id: command.id,
                type: 'canvas.mcp',
                label: JSON.stringify(body?.result ?? {}, null, 2),
                timestamp: Date.now(),
              });

              return;
            }

            const result = await postCanvasCommands({ sessionId: SESSION_ID, commands: [command] });
            appendEvent({
              id: command.id,
              type: 'canvas.command',
              label: JSON.stringify(command, null, 2),
              timestamp: Date.now(),
            });
            if (result.warnings && result.warnings.length > 0) {
              result.warnings.forEach((warning) => {
                appendEvent({
                  id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  type: 'canvas.warning',
                  label: warning,
                  timestamp: Date.now(),
                });
              });
            }
          } catch (error) {
            appendEvent({
              id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              type: 'canvas.error',
              label:
                error instanceof Error
                  ? error.message
                  : 'Failed to relay canvas command to server.',
              timestamp: Date.now(),
            });
          }
        },
      });
    },
    [appendEvent, finalizeTranscript, upsertBuffer],
  );

  const handleRemoteTrack = useCallback((event: RTCTrackEvent) => {
    const [remoteStream] = event.streams;
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, []);

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    appendEvent({
      id: randomId(),
      type: 'connection.state',
      label: state,
      timestamp: Date.now(),
    });
    console.info('WebRTC connection state changed:', state);
  }, [appendEvent]);

  const toggleSession = useCallback(async () => {
    if (status === 'active') {
      sessionHandles?.localStream.getTracks().forEach((track) => track.stop());
      sessionHandles?.peerConnection.close();
      setSessionHandles(null);
      responseBuffer.current.clear();
      userBuffer.current.clear();
      setEvents([]);
      setTranscripts([]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      setStatus('idle');
      setError(null);
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const session = await createRealtimeSession(
        async () => {
          const response = await fetch('/api/voice/token', {
            method: 'POST',
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.message ?? 'Failed to obtain realtime credentials');
          }

          return (await response.json()) as {
            clientSecret: string;
            realtimeUrl: string;
          };
        },
        async () => navigator.mediaDevices.getUserMedia({ audio: true }),
        {
          onRemoteTrack: handleRemoteTrack,
          onControlMessage: handleControlMessage,
          onConnectionStateChange: handleConnectionStateChange,
        },
      );

      setSessionHandles(session);
      setStatus('active');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [
    handleConnectionStateChange,
    handleControlMessage,
    handleRemoteTrack,
    sessionHandles,
    status,
  ]);

  return (
    <>
      <article style={panelStyles}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Voice Session Status</h2>
        <p style={{ marginBottom: '0.5rem' }}>{statusLabel}</p>

        {error ? (
          <p style={{ color: '#f97316', marginBottom: '1rem' }}>{error}</p>
        ) : (
          <p style={{ marginBottom: '1rem' }}>
            WebRTC capture and OpenAI session negotiation are in progress. Once the backend token service
            is fully authorized, this panel will stream live audio and agent actions.
          </p>
        )}

        <button
          type="button"
          onClick={toggleSession}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '999px',
            border: 'none',
            cursor: status === 'connecting' ? 'progress' : 'pointer',
            background:
              status === 'active' ? '#f97316' : status === 'error' ? '#ef4444' : '#0ea5e9',
            color: '#0f172a',
            fontWeight: 600,
          }}
          disabled={status === 'connecting'}
        >
          {status === 'active' ? 'End Voice Session' : 'Start Voice Session'}
        </button>

        <audio ref={remoteAudioRef} autoPlay playsInline hidden />
      </article>

      <VoiceEventLog transcripts={transcripts} events={events} />
    </>
  );
}
