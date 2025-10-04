import type { ExcalidrawOperation, ExcalidrawElementPayload, ExcalidrawPoint } from '@/lib/canvas/types';

export type CanvasShape = ExcalidrawElementPayload & {
  id: string;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor?: string;
  strokeWidth: number;
  rotation: number;
  fillStyle?: ExcalidrawElementPayload['fillStyle'];
  strokeStyle?: ExcalidrawElementPayload['strokeStyle'];
  opacity?: number;
  points?: ExcalidrawElementPayload['points'];
  isDeleted?: boolean;
};

export type ExcalidrawScene = {
  elements: CanvasShape[];
};

type ExcalidrawState = {
  sessions: Map<string, ExcalidrawScene>;
};

const globalState = globalThis as typeof globalThis & {
  __virtualSA__excalidrawState?: ExcalidrawState;
};

function getState(): ExcalidrawState {
  if (!globalState.__virtualSA__excalidrawState) {
    globalState.__virtualSA__excalidrawState = {
      sessions: new Map(),
    };
  }
  return globalState.__virtualSA__excalidrawState;
}

function normalizeElement(payload: ExcalidrawElementPayload): CanvasShape {
  const width = normalizeDimension(payload, 'width');
  const height = normalizeDimension(payload, 'height');
  const enforcedPoints = ensurePoints(payload, width, height);

  return {
    id: payload.id ?? `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: payload.type,
    x: payload.x,
    y: payload.y,
    width,
    height,
    text: payload.text,
    rotation: payload.rotation ?? 0,
    strokeColor: payload.strokeColor ?? '#22d3ee',
    backgroundColor: payload.backgroundColor ?? 'transparent',
    strokeWidth: payload.strokeWidth ?? 2,
    roughness: payload.roughness,
    roundness: payload.roundness,
    arrowhead: payload.arrowhead ?? null,
    points: enforcedPoints,
    fillStyle: payload.fillStyle ?? 'solid',
    strokeStyle: payload.strokeStyle ?? 'solid',
    opacity: payload.opacity ?? 100,
  };
}

function normalizeDimension(payload: ExcalidrawElementPayload, field: 'width' | 'height'): number {
  if (typeof payload[field] === 'number' && !Number.isNaN(payload[field])) {
    return Math.max(1, payload[field] as number);
  }
  if (payload.points && payload.points.length > 0) {
    const values = payload.points.map((point) => (field === 'width' ? point[0] : point[1]));
    const last = values[values.length - 1];
    return Math.max(1, Math.abs(last));
  }
  return field === 'width' ? 120 : 80;
}

function ensurePoints(
  payload: ExcalidrawElementPayload,
  fallbackWidth: number,
  fallbackHeight: number,
): ExcalidrawPoint[] | undefined {
  if (payload.type !== 'arrow' && payload.type !== 'line' && payload.type !== 'freedraw') {
    return payload.points;
  }

  if (payload.points && payload.points.length > 0) {
    return payload.points;
  }

  if (payload.type === 'freedraw') {
    return [
      [0, 0],
      [fallbackWidth, fallbackHeight],
    ];
  }

  return [
    [0, 0],
    [fallbackWidth, fallbackHeight],
  ];
}

function applyOperation(scene: ExcalidrawScene, operation: ExcalidrawOperation): ExcalidrawScene {
  switch (operation.kind) {
    case 'add_elements': {
      const additions = operation.elements.map(normalizeElement);
      return { elements: [...scene.elements, ...additions] };
    }
    case 'update_element': {
      const next = scene.elements.map((element) =>
        element.id === operation.id
          ? {
              ...element,
              ...operation.props,
            }
          : element,
      );
      return { elements: next };
    }
    case 'remove_element': {
      const next = scene.elements.filter((element) => element.id !== operation.id);
      return { elements: next };
    }
    case 'clear_scene':
      return { elements: [] };
    default:
      return scene;
  }
}

export function applyExcalidrawOperations(sessionId: string, operations: ExcalidrawOperation[]): ExcalidrawScene {
  const state = getState();
  const current = state.sessions.get(sessionId) ?? { elements: [] };
  const next = operations.reduce<ExcalidrawScene>((scene, operation) => applyOperation(scene, operation), current);
  state.sessions.set(sessionId, next);
  return next;
}

export function getExcalidrawScene(sessionId: string): ExcalidrawScene {
  const state = getState();
  return state.sessions.get(sessionId) ?? { elements: [] };
}

export function resetExcalidrawScene(sessionId: string) {
  const state = getState();
  state.sessions.delete(sessionId);
}
