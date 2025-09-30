import { getExcalidrawMcpSessionId, getExcalidrawMcpUrl } from '@/lib/config/env';

export type McpOperation = 'create_elements' | 'update_element' | 'delete_element' | 'clear_scene';

export async function callExcalidrawMcp(
  operation: McpOperation,
  payload: Record<string, unknown> = {},
): Promise<any> {
  const baseUrl = getExcalidrawMcpUrl();
  const sessionId = getExcalidrawMcpSessionId();

  let url = `${baseUrl}`;
  let method: 'POST' | 'PUT' | 'DELETE';
  let body: Record<string, unknown> | undefined;

  switch (operation) {
    case 'create_elements':
      url += '/api/elements/batch';
      method = 'POST';
      body = {
        sessionId,
        elements: Array.isArray(payload.elements) ? payload.elements : [payload],
      };
      break;

    case 'update_element':
      if (typeof payload.id !== 'string') {
        throw new Error('update_element requires payload.id');
      }
      url += `/api/elements/${encodeURIComponent(payload.id)}`;
      method = 'PUT';
      body = {
        ...payload,
        sessionId,
      };
      break;

    case 'delete_element':
      if (typeof payload.id !== 'string') {
        throw new Error('delete_element requires payload.id');
      }
      url += `/api/elements/${encodeURIComponent(payload.id)}`;
      method = 'DELETE';
      body = undefined;
      break;

    case 'clear_scene':
      url += '/api/canvas/events';
      method = 'POST';
      body = {
        sessionId,
        commands: [
          {
            id: `cmd_${Date.now()}`,
            sessionId,
            type: 'excalidraw.patch',
            payload: {
              operations: [
                {
                  kind: 'clear_scene',
                },
              ],
              summary: 'Clearing scene via MCP request',
            },
            issuedAt: Date.now(),
            issuedBy: 'agent',
          },
        ],
      };
      break;

    default:
      throw new Error(`Unsupported MCP operation: ${operation}`);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Excalidraw MCP request failed: ${response.status} ${response.statusText} ${text}`);
  }

  return response.json();
}
