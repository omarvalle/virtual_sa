import type { ExcalidrawElementPayload } from '@/lib/canvas/types';

function parseNumber(value: unknown, fallback?: number): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

export function toElementPayload(
  data: Record<string, unknown>,
  defaults: { width?: number; height?: number } = {},
): ExcalidrawElementPayload {
  const rawType = typeof data.type === 'string' ? data.type.toLowerCase() : 'rectangle';
  const type: ExcalidrawElementPayload['type'] =
    rawType === 'ellipse' || rawType === 'circle'
      ? 'ellipse'
      : rawType === 'diamond'
        ? 'diamond'
        : rawType === 'arrow'
          ? 'arrow'
          : rawType === 'text'
            ? 'text'
            : 'rectangle';

  const x = parseNumber(data.x, 200) ?? 200;
  const y = parseNumber(data.y, 140) ?? 140;
  const width = parseNumber(data.width, defaults.width) ?? defaults.width ?? (type === 'arrow' ? 160 : 120);
  const height = parseNumber(data.height, defaults.height) ?? defaults.height ?? (type === 'arrow' ? 40 : 120);

  return {
    id: typeof data.id === 'string' ? data.id : undefined,
    type,
    x,
    y,
    width,
    height,
    text: typeof data.text === 'string' ? data.text : undefined,
    rotation: parseNumber(data.rotation, 0) ?? 0,
    strokeColor:
      typeof data.strokeColor === 'string'
        ? data.strokeColor
        : typeof data.color === 'string'
          ? data.color
          : '#22d3ee',
    backgroundColor:
      typeof data.backgroundColor === 'string'
        ? data.backgroundColor
        : typeof data.fillColor === 'string'
          ? data.fillColor
          : type === 'arrow'
            ? undefined
            : 'rgba(34, 211, 238, 0.2)',
    strokeWidth: parseNumber(data.strokeWidth, 2) ?? 2,
    roughness: parseNumber(data.roughness),
    roundness: parseNumber(data.roundness),
    arrowhead:
      data.arrowhead === 'arrow' || data.arrowhead === 'bar' || data.arrowhead === 'circle'
        ? data.arrowhead
        : null,
  };
}

export function toElementProps(data: Record<string, unknown>): Partial<ExcalidrawElementPayload> {
  const result: Partial<ExcalidrawElementPayload> = {};

  if (typeof data.id === 'string') {
    result.id = data.id;
  }

  if (typeof data.type === 'string') {
    const lower = data.type.toLowerCase();
    if (lower === 'ellipse' || lower === 'circle') {
      result.type = 'ellipse';
    } else if (lower === 'diamond') {
      result.type = 'diamond';
    } else if (lower === 'arrow') {
      result.type = 'arrow';
    } else if (lower === 'text') {
      result.type = 'text';
    } else {
      result.type = 'rectangle';
    }
  }

  const numericKeys: Array<keyof ExcalidrawElementPayload> = ['x', 'y', 'width', 'height', 'rotation', 'strokeWidth', 'roughness', 'roundness'];
  numericKeys.forEach((key) => {
    const parsed = parseNumber((data as Record<string, unknown>)[key]);
    if (parsed !== undefined) {
      (result as Record<string, unknown>)[key] = parsed;
    }
  });

  if (typeof data.text === 'string') {
    result.text = data.text;
  }
  if (typeof data.strokeColor === 'string') {
    result.strokeColor = data.strokeColor;
  } else if (typeof data.color === 'string') {
    result.strokeColor = data.color;
  }
  if (typeof data.backgroundColor === 'string') {
    result.backgroundColor = data.backgroundColor;
  } else if (typeof data.fillColor === 'string') {
    result.backgroundColor = data.fillColor;
  }
  if (data.arrowhead === 'arrow' || data.arrowhead === 'bar' || data.arrowhead === 'circle') {
    result.arrowhead = data.arrowhead;
  }

  return result;
}

export function extractSessionId(data: Record<string, unknown>): string {
  const fromBody = typeof data.sessionId === 'string' ? data.sessionId : undefined;
  return fromBody ?? 'primary-session';
}
