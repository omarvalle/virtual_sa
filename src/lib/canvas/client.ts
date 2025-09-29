import type { CanvasCommand, CanvasCommandBatch } from '@/lib/canvas/types';

export type PostCanvasResponse = {
  accepted: number;
  warnings?: string[];
};

export async function postCanvasCommands(batch: CanvasCommandBatch): Promise<PostCanvasResponse> {
  const response = await fetch('/api/canvas/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to send canvas commands.');
  }

  return (await response.json()) as PostCanvasResponse;
}

export async function fetchCanvasCommands(sessionId: string): Promise<CanvasCommand[]> {
  const response = await fetch(`/api/canvas/events?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to fetch canvas commands.');
  }

  const body = (await response.json()) as { commands: CanvasCommand[] };
  return body.commands;
}

export async function clearCanvasCommands(sessionId: string): Promise<void> {
  const response = await fetch(`/api/canvas/events?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to clear canvas commands.');
  }
}
