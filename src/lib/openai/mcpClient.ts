import { getExcalidrawMcpMode, getExcalidrawMcpUrl, getMcpServiceApiKey } from '@/lib/config/env';
import type { ExcalidrawElementPayload, ExcalidrawOperation, ExcalidrawPoint } from '@/lib/canvas/types';

export type McpOperation = 'create_elements' | 'update_element' | 'delete_element' | 'clear_scene';

type ExcalidrawMcpResult = {
  operations: ExcalidrawOperation[];
  summary?: string;
  elements?: ExcalidrawElementPayload[];
  rawResponse?: unknown;
};

type CallToolResult = {
  blocks: string[];
  raw: unknown;
};

const ELEMENT_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'arrow', 'text', 'label', 'freedraw', 'line']);

const RANDOM_PREFIX = 'shape_';

function nextShapeId(index: number): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `${RANDOM_PREFIX}${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonSection(blocks: string[]): unknown {
  for (const block of blocks) {
    if (typeof block !== 'string') continue;
    const first = block.indexOf('{');
    const last = block.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      continue;
    }
    const candidate = block.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      continue;
    }
  }
  return null;
}

function normalizeElement(raw: any): ExcalidrawElementPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const typeValue = typeof raw.type === 'string' ? raw.type.toLowerCase() : '';
  if (!ELEMENT_TYPES.has(typeValue)) {
    return null;
  }

  const x = Number(raw.x);
  const y = Number(raw.y);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  const element: ExcalidrawElementPayload = {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    type: typeValue as ExcalidrawElementPayload['type'],
    x,
    y,
  };

  if (typeof raw.width === 'number') {
    element.width = raw.width;
  }
  if (typeof raw.height === 'number') {
    element.height = raw.height;
  }
  if (typeof raw.text === 'string') {
    element.text = raw.text;
  } else if (raw.label && typeof raw.label === 'object' && typeof raw.label.text === 'string') {
    element.text = raw.label.text;
  }
  if (typeof raw.rotation === 'number') {
    element.rotation = raw.rotation;
  }
  if (typeof raw.strokeColor === 'string') {
    element.strokeColor = raw.strokeColor;
  }
  if (typeof raw.backgroundColor === 'string') {
    element.backgroundColor = raw.backgroundColor;
  }
  if (typeof raw.strokeWidth === 'number') {
    element.strokeWidth = raw.strokeWidth;
  }
  if (typeof raw.roughness === 'number') {
    element.roughness = raw.roughness;
  }
  if (typeof raw.roundness === 'number') {
    element.roundness = raw.roundness;
  }
  if (typeof raw.arrowhead === 'string') {
    const arrowhead = raw.arrowhead as string;
    if (arrowhead === 'arrow' || arrowhead === 'bar' || arrowhead === 'circle') {
      element.arrowhead = arrowhead;
    }
  }

  return element;
}

function prepareElementInput(value: unknown, index: number): {
  remote: Record<string, unknown>;
  fallback: ExcalidrawElementPayload;
} {
  if (!value || typeof value !== 'object') {
    throw new Error('Element payload must be an object.');
  }

  const record = value as Record<string, unknown>;
  const typeValue = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  if (!ELEMENT_TYPES.has(typeValue)) {
    throw new Error(`Unsupported element type: ${String(record.type)}`);
  }

  const x = Number(record.x);
  const y = Number(record.y);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error('Element requires numeric x and y coordinates.');
  }

  const remote: Record<string, unknown> = {
    type: typeValue,
    x,
    y,
  };

  if (typeof record.width === 'number') remote.width = record.width;
  if (typeof record.height === 'number') remote.height = record.height;
  if (Array.isArray(record.points)) remote.points = record.points;
  if (typeof record.backgroundColor === 'string') remote.backgroundColor = record.backgroundColor;
  if (typeof record.strokeColor === 'string') remote.strokeColor = record.strokeColor;
  if (typeof record.strokeWidth === 'number') remote.strokeWidth = record.strokeWidth;
  if (typeof record.roughness === 'number') remote.roughness = record.roughness;
  if (typeof record.opacity === 'number') remote.opacity = record.opacity;
  if (typeof record.text === 'string') remote.text = record.text;
  if (typeof record.fontSize === 'number') remote.fontSize = record.fontSize;
  if (typeof record.fontFamily === 'string' || typeof record.fontFamily === 'number') {
    remote.fontFamily = record.fontFamily;
  }
  if (typeof record.fillStyle === 'string') remote.fillStyle = record.fillStyle;
  if (typeof record.strokeStyle === 'string') remote.strokeStyle = record.strokeStyle;
  if (typeof record.src === 'string') remote.src = record.src;

  const text = typeof record.text === 'string'
    ? record.text
    : record.label && typeof record.label === 'object' && typeof (record.label as { text?: unknown }).text === 'string'
      ? (record.label as { text?: string }).text
      : undefined;

  const fallback: ExcalidrawElementPayload = {
    id: typeof record.id === 'string' ? record.id : nextShapeId(index),
    type: typeValue as ExcalidrawElementPayload['type'],
    x,
    y,
  };

  if (typeof record.width === 'number') fallback.width = record.width;
  if (typeof record.height === 'number') fallback.height = record.height;
  if (typeof record.strokeColor === 'string') fallback.strokeColor = record.strokeColor;
  if (typeof record.backgroundColor === 'string') fallback.backgroundColor = record.backgroundColor;
  if (typeof record.strokeWidth === 'number') fallback.strokeWidth = record.strokeWidth;
  if (typeof record.roughness === 'number') fallback.roughness = record.roughness;
  if (typeof record.roundness === 'number') fallback.roundness = record.roundness;
  if (typeof record.arrowhead === 'string') {
    const arrowhead = record.arrowhead as string;
    if (arrowhead === 'arrow' || arrowhead === 'bar' || arrowhead === 'circle') {
      fallback.arrowhead = arrowhead;
    }
  }
  if (typeof record.rotation === 'number') fallback.rotation = record.rotation;
  if (Array.isArray(record.points)) fallback.points = record.points as ExcalidrawPoint[];
  if (typeof record.fillStyle === 'string') fallback.fillStyle = record.fillStyle;
  if (typeof record.strokeStyle === 'string') fallback.strokeStyle = record.strokeStyle;
  if (typeof record.opacity === 'number') fallback.opacity = record.opacity;
  if (typeof record.fontSize === 'number') fallback.fontSize = record.fontSize;
  if (typeof record.fontFamily === 'string' || typeof record.fontFamily === 'number') {
    fallback.fontFamily = String(record.fontFamily);
  }
  if (typeof record.src === 'string') fallback.src = record.src;
  if (text) fallback.text = text;

  return { remote, fallback };
}

function propsFromElement(element: ExcalidrawElementPayload): Partial<ExcalidrawElementPayload> {
  const { id, ...rest } = element;
  return rest;
}

async function callTool(
  baseUrl: string,
  apiKey: string | undefined,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const response = await fetch(`${baseUrl}/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({ name, arguments: args ?? {} }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Excalidraw MCP request failed: ${response.status} ${response.statusText} ${text}`);
  }

  const body = (await response.json()) as {
    error?: { message?: string };
    result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  };

  if (body.error) {
    throw new Error(body.error.message ?? 'Excalidraw MCP returned an error.');
  }

  const result = body.result;
  if (!result) {
    throw new Error('Excalidraw MCP response missing result.');
  }

  if (result.isError) {
    const combined = Array.isArray(result.content)
      ? result.content
          .map((entry) => (entry && entry.type === 'text' && typeof entry.text === 'string' ? entry.text : undefined))
          .filter(Boolean)
          .join('\n')
      : undefined;
    throw new Error(combined && combined.length > 0 ? combined : 'Excalidraw MCP reported an error.');
  }

  const blocks = Array.isArray(result.content)
    ? result.content
        .map((entry) => (entry && entry.type === 'text' && typeof entry.text === 'string' ? entry.text : undefined))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return { blocks, raw: body };
}

function extractElements(json: unknown): ExcalidrawElementPayload[] {
  if (!json || typeof json !== 'object') {
    return [];
  }

  const record = json as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(record.elements)) {
    candidates.push(...record.elements);
  } else if (Array.isArray(json)) {
    candidates.push(...(json as unknown[]));
  } else if (record.element) {
    candidates.push(record.element);
  }

  return candidates
    .map((candidate) => normalizeElement(candidate))
    .filter((element): element is ExcalidrawElementPayload => Boolean(element));
}

function sanitizeUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (key === 'id') {
      result.id = value;
      return;
    }
    if (key === 'type') {
      const typeValue = typeof value === 'string' ? value.toLowerCase() : '';
      if (ELEMENT_TYPES.has(typeValue)) {
        result.type = typeValue;
      }
      return;
    }
    if (typeof value === 'number' || typeof value === 'string' || Array.isArray(value)) {
      result[key] = value;
    }
  });

  return result;
}

function propsFromSanitizedUpdate(payload: Record<string, unknown>): Partial<ExcalidrawElementPayload> {
  const props: Partial<ExcalidrawElementPayload> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'id' || value === undefined || value === null) {
      return;
    }

    if (key === 'type' && typeof value === 'string') {
      const typeValue = value.toLowerCase();
      if (ELEMENT_TYPES.has(typeValue)) {
        props.type = typeValue as ExcalidrawElementPayload['type'];
      }
      return;
    }

    if (key === 'x' || key === 'y' || key === 'width' || key === 'height' || key === 'rotation') {
      if (typeof value === 'number') {
        (props as Record<string, unknown>)[key] = value;
      }
      return;
    }

    if (
      key === 'strokeColor' ||
      key === 'backgroundColor' ||
      key === 'text' ||
      key === 'strokeWidth' ||
      key === 'roughness' ||
      key === 'roundness' ||
      key === 'fontSize' ||
      key === 'fillStyle' ||
      key === 'strokeStyle'
    ) {
      (props as Record<string, unknown>)[key] = value;
      return;
    }

    if (key === 'fontFamily') {
      props.fontFamily = typeof value === 'number' ? String(value) : String(value);
      return;
    }

    if (key === 'arrowhead' && typeof value === 'string') {
      const arrowhead = value;
      if (arrowhead === 'arrow' || arrowhead === 'bar' || arrowhead === 'circle') {
        props.arrowhead = arrowhead;
      }
      return;
    }

    if (key === 'opacity' && typeof value === 'number') {
      props.opacity = value;
      return;
    }

    if (key === 'points' && Array.isArray(value)) {
      props.points = value as ExcalidrawPoint[];
      return;
    }
  });

  return props;
}

export async function callExcalidrawMcp(
  operation: McpOperation,
  payload: Record<string, unknown> = {},
): Promise<ExcalidrawMcpResult> {
  const mode = getExcalidrawMcpMode();
  if (mode === 'remote') {
    return callExcalidrawMcpRemote(operation, payload);
  }
  return callExcalidrawMcpLocal(operation, payload);
}

async function callExcalidrawMcpRemote(
  operation: McpOperation,
  payload: Record<string, unknown>,
): Promise<ExcalidrawMcpResult> {
  const baseUrl = getExcalidrawMcpUrl();
  const apiKey = getMcpServiceApiKey();

  switch (operation) {
    case 'create_elements': {
      const sourceElements = Array.isArray(payload.elements)
        ? (payload.elements as unknown[])
        : [payload];

      if (sourceElements.length === 0) {
        throw new Error('create_elements requires at least one element.');
      }

      const prepared = sourceElements.map((entry, index) => prepareElementInput(entry, index));
      const remoteElements = prepared.map((item) => item.remote);
      const fallbackElements = prepared.map((item) => item.fallback);

      const toolName = remoteElements.length > 1 ? 'batch_create_elements' : 'create_element';
      const toolArgs = remoteElements.length > 1 ? { elements: remoteElements } : remoteElements[0];

      const response = await callTool(baseUrl, apiKey, toolName, toolArgs as Record<string, unknown>);
      const parsed = parseJsonSection(response.blocks);
      const elements = extractElements(parsed);
      const normalizedElements = elements.length > 0 ? elements : fallbackElements;

      return {
        operations: [
          {
            kind: 'add_elements',
            elements: normalizedElements,
          },
        ],
        elements: normalizedElements,
        summary: `Created ${normalizedElements.length} element${normalizedElements.length === 1 ? '' : 's'}.`,
        rawResponse: response.raw,
      };
    }

    case 'update_element': {
      if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
        throw new Error('update_element requires payload.id.');
      }

      const sanitized = sanitizeUpdatePayload(payload);
      const response = await callTool(baseUrl, apiKey, 'update_element', sanitized);
      const parsed = parseJsonSection(response.blocks);
      const elements = extractElements(parsed);
      const normalized = elements[0] ?? null;

      const props = normalized ? propsFromElement(normalized) : propsFromSanitizedUpdate(sanitized);

      if (Object.keys(props).length === 0) {
        throw new Error('update_element did not include any properties to modify.');
      }

      return {
        operations: [
          {
            kind: 'update_element',
            id: payload.id,
            props,
          },
        ],
        elements: normalized ? [normalized] : undefined,
        summary: `Updated element ${payload.id}.`,
        rawResponse: response.raw,
      };
    }

    case 'delete_element': {
      if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
        throw new Error('delete_element requires payload.id.');
      }

      await callTool(baseUrl, apiKey, 'delete_element', { id: payload.id });

      return {
        operations: [
          {
            kind: 'remove_element',
            id: payload.id,
          },
        ],
        summary: `Deleted element ${payload.id}.`,
      };
    }

    case 'clear_scene': {
      const resourceResponse = await callTool(baseUrl, apiKey, 'get_resource', { resource: 'elements' });
      const parsed = parseJsonSection(resourceResponse.blocks);
      const elements = extractElements(parsed);
      const ids = elements.map((element) => element.id).filter((id): id is string => Boolean(id));

      for (const id of ids) {
        await callTool(baseUrl, apiKey, 'delete_element', { id });
      }

      return {
        operations: [
          {
            kind: 'clear_scene',
          },
        ],
        summary: ids.length > 0 ? `Cleared ${ids.length} element${ids.length === 1 ? '' : 's'}.` : 'Canvas already empty.',
        elements,
      };
    }

    default:
      throw new Error(`Unsupported MCP operation: ${operation}`);
  }
}

async function callExcalidrawMcpLocal(
  operation: McpOperation,
  payload: Record<string, unknown>,
): Promise<ExcalidrawMcpResult> {
  switch (operation) {
    case 'create_elements': {
      const sourceElements = Array.isArray(payload.elements)
        ? (payload.elements as unknown[])
        : [payload];

      if (sourceElements.length === 0) {
        throw new Error('create_elements requires at least one element.');
      }

      const prepared = sourceElements.map((entry, index) => prepareElementInput(entry, index).fallback);

      return {
        operations: [
          {
            kind: 'add_elements',
            elements: prepared,
          },
        ],
        elements: prepared,
        summary: `Created ${prepared.length} element${prepared.length === 1 ? '' : 's'}.`,
      };
    }

    case 'update_element': {
      if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
        throw new Error('update_element requires payload.id.');
      }

      const sanitized = sanitizeUpdatePayload(payload);
      const props = propsFromSanitizedUpdate(sanitized);

      if (Object.keys(props).length === 0) {
        throw new Error('update_element did not include any properties to modify.');
      }

      return {
        operations: [
          {
            kind: 'update_element',
            id: payload.id,
            props,
          },
        ],
        summary: `Updated element ${payload.id}.`,
      };
    }

    case 'delete_element': {
      if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
        throw new Error('delete_element requires payload.id.');
      }

      return {
        operations: [
          {
            kind: 'remove_element',
            id: payload.id,
          },
        ],
        summary: `Deleted element ${payload.id}.`,
      };
    }

    case 'clear_scene':
      return {
        operations: [
          {
            kind: 'clear_scene',
          },
        ],
        summary: 'Cleared canvas.',
      };

    default:
      throw new Error(`Unsupported MCP operation: ${operation}`);
  }
}
