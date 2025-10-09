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

type ToolSegment = {
  type?: string | null;
  text?: string | null;
};

function coerceRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractSegmentTexts(source: unknown, limit = 3): string[] {
  if (!Array.isArray(source)) {
    return [];
  }

  const texts: string[] = [];
  for (const entry of source as ToolSegment[]) {
    const type = typeof entry?.type === 'string' ? entry.type.trim().toLowerCase() : '';
    if (type === 'json') {
      continue;
    }
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    if (!text) {
      continue;
    }
    texts.push(text);
    if (texts.length >= limit) {
      break;
    }
  }

  return texts;
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
  const contextInstructionsRef = useRef<string | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);

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

  const loadSessionContext = useCallback(async () => {
    try {
      const response = await fetch('/api/conversation/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => 'Failed to load memory context.');
        appendEvent({
          id: randomId(),
          type: 'memory.error',
          label: message,
          timestamp: Date.now(),
        });
        contextInstructionsRef.current = null;
        return null;
      }

      const body = (await response.json()) as { instructions?: string };
      contextInstructionsRef.current = body.instructions ?? null;
      if (body.instructions) {
        appendEvent({
          id: randomId(),
          type: 'memory.context',
          label: body.instructions,
          timestamp: Date.now(),
        });
      } else {
        appendEvent({
          id: randomId(),
          type: 'memory.context',
          label: 'No prior summary available for this session.',
          timestamp: Date.now(),
        });
      }
      return body;
    } catch (error) {
      appendEvent({
        id: randomId(),
        type: 'memory.error',
        label: error instanceof Error ? error.message : 'Failed to load session context.',
        timestamp: Date.now(),
      });
      contextInstructionsRef.current = null;
      return null;
    }
  }, [appendEvent]);

  const persistSessionSummary = useCallback(
    async (turns: TranscriptLine[]) => {
      if (turns.length === 0) {
        return;
      }

      try {
        console.info('[memory] Persisting conversation summary', {
          turns: turns.length,
        });
        const response = await fetch('/api/conversation/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: SESSION_ID,
            transcripts: turns.map((turn) => ({
              speaker: turn.speaker,
              text: turn.text,
            })),
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          appendEvent({
            id: randomId(),
            type: 'memory.error',
            label: body?.message ?? 'Failed to persist conversation summary (non-OK response).',
            timestamp: Date.now(),
          });
        } else {
          appendEvent({
            id: randomId(),
            type: 'memory.summary',
            label: 'Conversation summary stored.',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        appendEvent({
          id: randomId(),
          type: 'memory.error',
          label: error instanceof Error ? error.message : 'Failed to persist conversation summary.',
          timestamp: Date.now(),
        });
      }
    },
    [appendEvent],
  );

  const sendToolEnvelope = useCallback(
    (payload: Record<string, unknown>) => {
      const channel = controlChannelRef.current;
      if (!channel) {
        appendEvent({
          id: randomId(),
          type: 'tool.error',
          label: 'No control channel available for tool payload.',
          timestamp: Date.now(),
        });
        return;
      }

      try {
        const serialized = JSON.stringify(payload);
        if (channel.readyState !== 'open') {
          appendEvent({
            id: randomId(),
            type: 'tool.warning',
            label: `Control channel not open (state: ${channel.readyState}). Payload dropped.`,
            timestamp: Date.now(),
          });
          return;
        }
        channel.send(serialized);
        appendEvent({
          id: randomId(),
          type: 'websocket.sent',
          label: serialized,
          timestamp: Date.now(),
        });
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
    [appendEvent],
  );

  const sendToolResult = useCallback(
    (
      _responseId: string,
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

      appendEvent({
        id: randomId(),
        type: 'tool.output',
        label: JSON.stringify({
          callId,
          output: trimmed,
          isError: Boolean(options.isError),
        }, null, 2),
        timestamp: Date.now(),
      });

      sendToolEnvelope({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: trimmed,
        },
      });
    },
    [appendEvent, sendToolEnvelope],
  );

  const resumeAfterTool = useCallback(
    (toolName: string, context?: string) => {
      sendToolEnvelope({
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: context
            ? `You just received new information from the tool ${toolName}: ${context}\nUse it to continue the task without waiting for the user unless clarification is needed.`
            : 'Continue assisting the user using the latest tool results. Only pause if you need clarification.',
          metadata: {
            resumed_after_tool: toolName,
            },
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
          : name.startsWith('perplexity_')
            ? 'perplexity'
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
          : namespace === 'perplexity'
            ? '/api/mcp/perplexity'
          : namespace === 'aws-diagram'
            ? '/api/mcp/aws-diagram'
            : '/api/mcp/tavily';

      const adjustedArguments = (() => {
        if (namespace === 'perplexity') {
          const clone = { ...toolArgs } as Record<string, unknown>;
          if (!('max_results' in clone)) {
            clone.max_results = 5;
          }
          if (!('max_tokens_per_page' in clone)) {
            clone.max_tokens_per_page = 1024;
          }
          return clone;
        }

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
          if (namespace === 'tavily' || namespace === 'perplexity') {
            const resultRecord = coerceRecord(body?.result);
            const rawRecord = coerceRecord(resultRecord?.raw) ?? coerceRecord(body?.raw);
            const payloadResults = resultRecord?.results as unknown;
            const rawResults = rawRecord?.results as unknown;
            const results = Array.isArray(payloadResults)
              ? (payloadResults as Array<Record<string, unknown>>)
              : Array.isArray(rawResults)
                ? (rawResults as Array<Record<string, unknown>>)
                : [];
            const answerCandidate = resultRecord?.answer ?? rawRecord?.answer;
            const answer =
              typeof answerCandidate === 'string' && answerCandidate.trim().length > 0
                ? answerCandidate.trim()
                : undefined;

            if (results.length > 0) {
              const lines = results.slice(0, 3).map((item, index) => {
                const record = coerceRecord(item) ?? ({} as Record<string, unknown>);
                const titleValue = record['title'];
                const urlValue = record['url'];
                const publishedValue = record['published'] ?? record['published_date'];
                const snippetValue = record['snippet'] ?? record['content'];
                const title =
                  typeof titleValue === 'string' && titleValue.trim().length > 0
                    ? titleValue.trim()
                    : 'Untitled result';
                const url = typeof urlValue === 'string' ? urlValue.trim() : '';
                const published =
                  typeof publishedValue === 'string' && publishedValue.trim().length > 0
                    ? ` (${publishedValue.trim()})`
                    : '';
                const rawSnippet = typeof snippetValue === 'string' ? snippetValue.trim() : '';
                const snippet = rawSnippet.length > 280 ? `${rawSnippet.slice(0, 277)}...` : rawSnippet;
                const snippetLine = snippet ? `\n  ${snippet}` : '';
                return `${index + 1}. ${title}${published}${url ? ` — ${url}` : ''}${snippetLine}`;
              });

              const heading = namespace === 'perplexity' ? 'Perplexity search results:' : `Tavily ${name} results:`;
              return [heading, ...lines, answer ? `Summary: ${answer}` : '']
                .filter(Boolean)
                .join('\n');
            }

            const segmentTexts = extractSegmentTexts(
              body?.segments ?? resultRecord?.segments ?? rawRecord?.segments,
            );
            const segmentSummaryParts = [...segmentTexts];
            if (answer) {
              segmentSummaryParts.push(`Summary: ${answer}`);
            }
            if (segmentSummaryParts.length > 0) {
              const heading = namespace === 'perplexity'
                ? 'Perplexity search results:'
                : `Tavily ${name} results:`;
              return [heading, ...segmentSummaryParts]
                .filter(Boolean)
                .join('\n\n');
            }

            if (answer) {
              const prefix = namespace === 'perplexity' ? 'Perplexity summary:' : `Tavily ${name} summary:`;
              return `${prefix} ${answer}`;
            }
          }

          if (namespace === 'knowledge') {
            const resultRecord = coerceRecord(body?.result);
            const rawRecord = coerceRecord(resultRecord?.raw);
            const rawResult = coerceRecord(rawRecord?.result);
            const segmentTexts = extractSegmentTexts(
              body?.segments ?? resultRecord?.segments ?? rawRecord?.segments ?? rawResult?.content,
            );
            if (segmentTexts.length > 0) {
              const trimmed = segmentTexts.map((text) => text.slice(0, 4000));
              return ['AWS Knowledge snippet:', ...trimmed].join('\n\n');
            }
          }

          if (namespace === 'aws-diagram') {
            const message = body?.diagram?.message ?? 'Generated AWS diagram.';
            const path = body?.diagram?.path ? ` Diagram path: ${body.diagram.path}` : '';
            return `${message}${path}`;
          }

          return JSON.stringify(body.result ?? body.diagram ?? body, null, 2);
        };

        const summaryTextRaw = summarise();
        const summaryText = summaryTextRaw ? summaryTextRaw.trim() : '';
        const resumeContext = summaryText ? summaryText.slice(0, 800) : undefined;

        if (responseId) {
          sendToolResult(responseId, callId, summaryText || 'Tool call completed with no textual summary.');
        } else if (summaryText) {
          // If we lack a tool call id, still surface the summary as a conversation item.
          sendToolEnvelope({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: summaryText,
                },
              ],
            },
          });
        }

        if (namespace === 'tavily' || namespace === 'knowledge' || namespace === 'perplexity') {
          resumeAfterTool(name, resumeContext);
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
            const diagramId = `diagram_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const fileId = `${diagramId}_file`;

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
                        id: diagramId,
                        type: 'image',
                        x: 80,
                        y: 80,
                        width,
                        height,
                        fileId,
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

        const errorMessage = (error instanceof Error ? error.message : 'External MCP request failed.').slice(0, 400);

        if (responseId) {
          sendToolResult(responseId, callId, errorMessage, { isError: true });
        } else {
          sendToolEnvelope({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: errorMessage,
                },
              ],
            },
          });
        }

        if (namespace === 'tavily' || namespace === 'knowledge' || namespace === 'perplexity') {
          resumeAfterTool(name, errorMessage);
        }
      }
    },
    [appendEvent, resumeAfterTool, sendToolEnvelope, sendToolResult],
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
      await persistSessionSummary(transcripts);
      sessionHandles?.localStream.getTracks().forEach((track) => track.stop());
      sessionHandles?.peerConnection.close();
      controlChannelRef.current = null;
      setSessionHandles(null);
      responseBuffer.current.clear();
      userBuffer.current.clear();
      setEvents([]);
      setTranscripts([]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      contextInstructionsRef.current = null;
      setStatus('idle');
      setError(null);
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      await loadSessionContext();
      const session = await createRealtimeSession(
        async () => {
          const instructions = contextInstructionsRef.current;
          const response = await fetch('/api/voice/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              instructions && instructions.length > 0 ? { instructions } : {},
            ),
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

      controlChannelRef.current = session.controlChannel;
      if (controlChannelRef.current) {
        controlChannelRef.current.addEventListener('open', () => {
          appendEvent({
            id: randomId(),
            type: 'control_channel.open',
            label: 'Control data channel opened.',
            timestamp: Date.now(),
          });
        });
        controlChannelRef.current.addEventListener('close', () => {
          appendEvent({
            id: randomId(),
            type: 'control_channel.close',
            label: 'Control data channel closed.',
            timestamp: Date.now(),
          });
          controlChannelRef.current = null;
        });
        controlChannelRef.current.addEventListener('error', (event) => {
          appendEvent({
            id: randomId(),
            type: 'control_channel.error',
            label: event instanceof Event ? 'Control channel error event fired.' : JSON.stringify(event),
            timestamp: Date.now(),
          });
        });
      }
      setSessionHandles(session);
      setStatus('active');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [
    appendEvent,
    handleConnectionStateChange,
    handleControlMessage,
    handleRemoteTrack,
    loadSessionContext,
    persistSessionSummary,
    sessionHandles,
    status,
    transcripts,
  ]);

  return (
    <>
      <article style={panelStyles}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Voice Session Status</h2>
        <p style={{ marginBottom: '0.5rem' }}>{statusLabel}</p>

        {error ? (
          <p style={{ color: '#f97316', marginBottom: '1rem' }}>{error}</p>
        ) : null}

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
