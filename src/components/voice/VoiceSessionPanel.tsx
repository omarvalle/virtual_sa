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

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth || 640, height: image.naturalHeight || 480 });
    };
    image.onerror = (error) => {
      reject(error);
    };
    image.src = dataUrl;
  });
}

function constrainDimensions(
  dimensions: { width: number; height: number },
  maxWidth = 640,
  maxHeight = 480,
  minSize = 120,
): { width: number; height: number } {
  const { width, height } = dimensions;
  if (!width || !height) {
    return { width: maxWidth, height: maxHeight };
  }

  const widthScale = maxWidth / width;
  const heightScale = maxHeight / height;
  const scale = Math.min(widthScale, heightScale, 1);
  const scaledWidth = Math.max(minSize, Math.round(width * scale));
  const scaledHeight = Math.max(minSize, Math.round(height * scale));
  return { width: scaledWidth, height: scaledHeight };
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

  const sendToolEnvelope = useCallback(
    (payload: Record<string, unknown>) => {
      if (!sessionHandles?.controlChannel) {
        return;
      }

      try {
        sessionHandles.controlChannel.send(JSON.stringify(payload));
      } catch (sendError) {
        appendEvent({
          id: randomId(),
          type: 'tool.error',
          label:
            sendError instanceof Error
              ? `Failed to submit tool payload: ${sendError.message}`
              : 'Failed to submit tool payload.',
          timestamp: Date.now(),
        });
      }
    },
    [appendEvent, sessionHandles?.controlChannel],
  );

  const sendToolResult = useCallback(
    (
      responseId: string,
      callId: string | undefined,
      content: string,
      options: { isError?: boolean } = {},
    ) => {
      const trimmed = content.length > 4000 ? `${content.slice(0, 4000)}…` : content;

      if (!callId) {
        sendToolEnvelope({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: trimmed,
              },
            ],
          },
        });
        return;
      }

      sendToolEnvelope({
        type: 'response.create',
        response: {
          id: responseId,
          status: 'completed' as const,
          output: [
            {
              type: 'tool_result' as const,
              tool_call_id: callId,
              content: [
                {
                  type: 'text' as const,
                  text: trimmed,
                },
              ],
              ...(options.isError ? { is_error: true as const } : {}),
            },
          ],
        },
      });
    },
    [sendToolEnvelope],
  );

  const handleExternalToolCall = useCallback(
    async ({
      name,
      arguments: toolArgs,
      responseId,
      callId,
    }: {
      name: string;
      arguments: Record<string, unknown>;
      responseId: string;
      callId?: string;
    }) => {
      const namespace = name.startsWith('aws_knowledge')
        ? 'knowledge'
        : name.startsWith('tavily_')
          ? 'tavily'
          : name.startsWith('aws_')
            ? 'aws-diagram'
            : 'tool';

      if (!callId) {
        appendEvent({
          id: randomId(),
          type: `${namespace}.warning`,
          label: 'Missing call_id for external tool invocation; falling back to system memo.',
          timestamp: Date.now(),
        });
      }

      const endpoint = namespace === 'knowledge'
        ? '/api/mcp/aws-knowledge'
        : namespace === 'tavily'
          ? '/api/mcp/tavily'
          : namespace === 'aws-diagram'
            ? '/api/mcp/aws-diagram'
            : '/api/mcp/tavily';

      const adjustedArguments = (() => {
        if (namespace !== 'tavily') {
          return toolArgs;
        }

        const clone = { ...toolArgs } as Record<string, unknown>;

        if (!('max_results' in clone)) {
          clone.max_results = 4;
        }
        if (!('include_answer' in clone)) {
          clone.include_answer = 'basic';
        }
        if (!('include_raw_content' in clone)) {
          clone.include_raw_content = false;
        }
        if (clone.search_depth === undefined) {
          clone.search_depth = 'basic';
        }

        return clone;
      })();

      appendEvent({
        id: randomId(),
        type: `${namespace}.request`,
        label: JSON.stringify({ tool: name, arguments: adjustedArguments }, null, 2),
        timestamp: Date.now(),
      });

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tool: name, arguments: adjustedArguments }),
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok || !body?.success) {
          const message = body?.message ?? 'External MCP request failed.';
          throw new Error(message);
        }

        appendEvent({
          id: randomId(),
          type: `${namespace}.result`,
          label: JSON.stringify(body.result ?? body.diagram ?? body, null, 2),
          timestamp: Date.now(),
        });

        const summarise = () => {
          if (namespace === 'tavily') {
            const results = (body?.result?.results ?? body?.results ?? []) as Array<{
              title?: string;
              url?: string;
              content?: string;
              published?: string;
            }>;
            if (Array.isArray(results) && results.length > 0) {
              const lines = results.slice(0, 3).map((item, index) => {
                const title = item.title ? item.title.trim() : 'Untitled result';
                const url = item.url ? item.url.trim() : '';
                const published = item.published ? ` (${item.published})` : '';
                return `${index + 1}. ${title}${published}${url ? ` — ${url}` : ''}`;
              });

              const answer =
                typeof body?.result?.answer === 'string' && body.result.answer.trim().length > 0
                  ? `Summary: ${body.result.answer.trim()}`
                  : undefined;

              return [`Tavily ${name} results:`, ...lines, answer ?? '']
                .filter(Boolean)
                .join('\n');
            }
          }

          if (namespace === 'knowledge') {
            const segments = (body?.segments ?? body?.result?.content ?? []) as Array<{
              text?: string;
            }>;
            const first = segments.find((segment) => typeof segment?.text === 'string');
            if (first?.text) {
              return `AWS Knowledge snippet:\n${first.text.slice(0, 4000)}`;
            }
          }

          if (namespace === 'aws-diagram') {
            const message = body?.diagram?.message ?? 'Generated AWS diagram.';
            const path = body?.diagram?.path ? ` Diagram path: ${body.diagram.path}` : '';
            return `${message}${path}`;
          }

          return JSON.stringify(body.result ?? body.diagram ?? body, null, 2);
        };

        if (responseId) {
          sendToolResult(responseId, callId, summarise());
        }

        if (namespace === 'aws-diagram' && body?.diagram?.imageBase64) {
          appendEvent({
            id: randomId(),
            type: `${namespace}.image`,
            label: body.diagram.imageBase64,
            timestamp: Date.now(),
          });

          const baseImage = body.diagram.imageBase64 as string;

          try {
            const rawDimensions = await loadImageDimensions(baseImage).catch(() => ({ width: 640, height: 480 }));
            const { width, height } = constrainDimensions(rawDimensions);

            const addCommand = {
              id: randomId(),
              sessionId: SESSION_ID,
              type: 'excalidraw.patch' as const,
              payload: {
                summary: 'Added AWS diagram snapshot to canvas',
                operations: [
                  {
                    kind: 'add_elements',
                    elements: [
                      {
                        id: `diagram_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        type: 'image',
                        x: 80,
                        y: 80,
                        width,
                        height,
                        src: baseImage,
                        strokeColor: '#0ea5e9',
                        backgroundColor: 'transparent',
                      },
                    ],
                  },
                ],
              },
              issuedAt: Date.now(),
              issuedBy: 'user' as const,
            };

            const result = await postCanvasCommands({
              sessionId: SESSION_ID,
              commands: [addCommand],
            });

            appendEvent({
              id: addCommand.id,
              type: 'canvas.command',
              label: JSON.stringify(addCommand, null, 2),
              timestamp: Date.now(),
            });

            if (result.warnings && result.warnings.length > 0) {
              result.warnings.forEach((warning) => {
                appendEvent({
                  id: randomId(),
                  type: 'canvas.warning',
                  label: warning,
                  timestamp: Date.now(),
                });
              });
            }
          } catch (error) {
            appendEvent({
              id: randomId(),
              type: 'canvas.error',
              label: error instanceof Error ? error.message : 'Failed to place AWS diagram on canvas.',
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        appendEvent({
          id: randomId(),
          type: `${namespace}.error`,
          label: error instanceof Error ? error.message : 'Failed to execute MCP request.',
          timestamp: Date.now(),
        });

        if (responseId) {
          sendToolResult(
            responseId,
            callId,
            error instanceof Error ? error.message : 'External MCP request failed.',
            { isError: true },
          );
        }
      }
    },
    [appendEvent, sendToolResult],
  );

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

              const rawBody = (await response.json().catch(() => ({}))) as {
                success?: boolean;
                message?: string;
                operations?: unknown;
                summary?: string;
                warnings?: string[];
                elements?: unknown;
                rawResponse?: unknown;
              };

              if (!response.ok || !rawBody?.success) {
                throw new Error(rawBody?.message ?? 'MCP request failed.');
              }

              appendEvent({
                id: command.id,
                type: 'canvas.mcp',
                label: JSON.stringify(
                  {
                    summary: rawBody.summary ?? null,
                    operations: rawBody.operations ?? [],
                    elements: rawBody.elements ?? [],
                  },
                  null,
                  2,
                ),
                timestamp: Date.now(),
              });

              const operations = Array.isArray(rawBody.operations) ? rawBody.operations : [];

              if (operations.length > 0) {
                const patchCommand = {
                  id: randomId(),
                  sessionId: SESSION_ID,
                  type: 'excalidraw.patch' as const,
                  payload: {
                    operations,
                    ...(typeof rawBody.summary === 'string' && rawBody.summary.length > 0
                      ? { summary: rawBody.summary }
                      : {}),
                  },
                  issuedAt: Date.now(),
                  issuedBy: 'agent' as const,
                };

                try {
                  const result = await postCanvasCommands({
                    sessionId: SESSION_ID,
                    commands: [patchCommand],
                  });

                  appendEvent({
                    id: patchCommand.id,
                    type: 'canvas.command',
                    label: JSON.stringify(patchCommand, null, 2),
                    timestamp: Date.now(),
                  });

                  if (result.warnings && result.warnings.length > 0) {
                    result.warnings.forEach((warning) => {
                      appendEvent({
                        id: randomId(),
                        type: 'canvas.warning',
                        label: warning,
                        timestamp: Date.now(),
                      });
                    });
                  }
                } catch (error) {
                  appendEvent({
                    id: randomId(),
                    type: 'canvas.error',
                    label:
                      error instanceof Error
                        ? error.message
                        : 'Failed to relay MCP canvas operations to server.',
                    timestamp: Date.now(),
                  });
                }
              }

              if (Array.isArray(rawBody.warnings) && rawBody.warnings.length > 0) {
                rawBody.warnings.forEach((warning) => {
                  appendEvent({
                    id: randomId(),
                    type: 'canvas.warning',
                    label: warning,
                    timestamp: Date.now(),
                  });
                });
              }

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
        onExternalToolCall: ({ name, arguments: externalArgs, responseId: extResponseId, callId }) => {
          handleExternalToolCall({
            name,
            arguments: externalArgs,
            responseId: extResponseId,
            callId,
          });
        },
      });
    },
    [appendEvent, finalizeTranscript, handleExternalToolCall, upsertBuffer],
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
