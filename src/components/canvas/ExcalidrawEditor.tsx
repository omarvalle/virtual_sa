'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types/types';
import '@excalidraw/excalidraw/index.css';

function stableSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
import { postCanvasCommands } from '@/lib/canvas/client';
import type { CanvasShape } from '@/lib/canvas/excalidrawState';
import type { ExcalidrawElementPayload, ExcalidrawOperation } from '@/lib/canvas/types';

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

function hashShapes(shapes: CanvasShape[]): string {
  return JSON.stringify(
    shapes.map((shape) => ({
      id: shape.id,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      rotation: shape.rotation,
      strokeColor: shape.strokeColor,
      backgroundColor: shape.backgroundColor,
      text: shape.text ?? null,
      points: shape.points ?? null,
      src: shape.src ?? null,
      fileId: shape.fileId ?? null,
    })),
  );
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const bufferCtor = typeof globalThis !== 'undefined' ? (globalThis as { Buffer?: typeof Buffer }).Buffer : undefined;
  if (bufferCtor) {
    return Uint8Array.from(bufferCtor.from(base64, 'base64'));
  }

  throw new Error('No base64 decoder available.');
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  const mimeType = match[1] && match[1].length > 0 ? match[1] : 'image/png';
  const base64 = match[2];
  try {
    const bytes = decodeBase64(base64);
    return { mimeType, bytes };
  } catch (error) {
    console.warn('[canvas] Failed to parse data URL', error);
    return null;
  }
}

function toCanvasShape(element: ExcalidrawElement): CanvasShape {
  const rotation = typeof element.angle === 'number' ? (element.angle * 180) / Math.PI : 0;
  const points = Array.isArray(element.points)
    ? element.points
        .filter((point): point is readonly [number, number] => Array.isArray(point) && point.length >= 2)
        .map((point) => [Number(point[0]) || 0, Number(point[1]) || 0] as [number, number])
    : undefined;
  const rawFontFamily = (element as { fontFamily?: unknown }).fontFamily;
  const fontFamily =
    typeof rawFontFamily === 'number'
      ? String(rawFontFamily)
      : typeof rawFontFamily === 'string'
        ? rawFontFamily
        : undefined;
  const fileId = (element as { fileId?: string }).fileId;
  const status = (element as { status?: CanvasShape['status'] }).status;
  const src = (element as { src?: string }).src;

  return {
    id: element.id,
    type: element.type as CanvasShape['type'],
    x: element.x ?? 0,
    y: element.y ?? 0,
    width: element.width ?? 1,
    height: element.height ?? 1,
    text: 'text' in element ? (element as { text?: string }).text : undefined,
    fontSize: 'fontSize' in element ? (element as { fontSize?: number }).fontSize : undefined,
    fontFamily,
    rotation,
    strokeColor: element.strokeColor ?? '#1e1e1e',
    backgroundColor: element.backgroundColor ?? 'transparent',
    strokeWidth: element.strokeWidth ?? 2,
    roughness: element.roughness,
    roundness: typeof element.roundness === 'number' ? element.roundness : undefined,
    arrowhead:
      element.type === 'arrow' && (element as { endArrowhead?: string }).endArrowhead
        ? ((element as { endArrowhead?: string }).endArrowhead as CanvasShape['arrowhead'])
        : null,
    points,
    fillStyle: element.fillStyle ?? 'solid',
    strokeStyle: element.strokeStyle ?? 'solid',
    opacity: typeof element.opacity === 'number' ? element.opacity : undefined,
    src,
    fileId,
    status,
  };
}

function toElementPayload(shape: CanvasShape): ExcalidrawElementPayload {
  return {
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    text: shape.text,
    fontSize: shape.fontSize,
    fontFamily: shape.fontFamily,
    rotation: shape.rotation,
    strokeColor: shape.strokeColor,
    backgroundColor: shape.backgroundColor,
    strokeWidth: shape.strokeWidth,
    roughness: shape.roughness,
    roundness: shape.roundness,
    arrowhead: shape.arrowhead,
    points: shape.points,
    fillStyle: shape.fillStyle,
    strokeStyle: shape.strokeStyle,
    opacity: shape.opacity,
    src: shape.src,
    fileId: shape.fileId,
    status: shape.status,
  };
}

function diffShape(prev: CanvasShape | undefined, next: CanvasShape): Partial<ExcalidrawElementPayload> | null {
  if (!prev) {
    return null;
  }

  const changed: Partial<ExcalidrawElementPayload> = {};
  const delta = (a: number, b: number) => Math.abs(a - b) > 0.25;

  if (delta(prev.x, next.x)) changed.x = next.x;
  if (delta(prev.y, next.y)) changed.y = next.y;
  if (delta(prev.width, next.width)) changed.width = next.width;
  if (delta(prev.height, next.height)) changed.height = next.height;
  if (delta(prev.rotation ?? 0, next.rotation ?? 0)) changed.rotation = next.rotation;
  if ((prev.strokeColor ?? '') !== (next.strokeColor ?? '')) changed.strokeColor = next.strokeColor;
  if ((prev.backgroundColor ?? '') !== (next.backgroundColor ?? '')) changed.backgroundColor = next.backgroundColor;
  if ((prev.strokeWidth ?? 0) !== (next.strokeWidth ?? 0)) changed.strokeWidth = next.strokeWidth;
  if ((prev.fillStyle ?? '') !== (next.fillStyle ?? '')) changed.fillStyle = next.fillStyle;
  if ((prev.strokeStyle ?? '') !== (next.strokeStyle ?? '')) changed.strokeStyle = next.strokeStyle;
  if ((prev.opacity ?? 100) !== (next.opacity ?? 100)) changed.opacity = next.opacity;
  if ((prev.text ?? '') !== (next.text ?? '')) changed.text = next.text;
  if ((prev.fontSize ?? 0) !== (next.fontSize ?? 0)) changed.fontSize = next.fontSize;
  if ((prev.fontFamily ?? '') !== (next.fontFamily ?? '')) changed.fontFamily = next.fontFamily;

  const prevPoints = prev.points ?? null;
  const nextPoints = next.points ?? null;
  if (JSON.stringify(prevPoints) !== JSON.stringify(nextPoints)) {
    changed.points = nextPoints ?? undefined;
  }

  if ((prev.src ?? '') !== (next.src ?? '')) {
    changed.src = next.src;
  }

  if ((prev.fileId ?? '') !== (next.fileId ?? '')) {
    changed.fileId = next.fileId;
  }
  if ((prev.status ?? '') !== (next.status ?? '')) {
    changed.status = next.status;
  }

  return Object.keys(changed).length > 0 ? changed : null;
}

export function ExcalidrawEditor({ sessionId }: { sessionId: string }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedHash = useRef<string>('');
  const isUpdatingFromServer = useRef(false);
  const serverShapesRef = useRef<Map<string, CanvasShape>>(new Map());
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null);
  const syncTimerRef = useRef<number>();

  const clearSyncTimer = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearSyncTimer(), [clearSyncTimer]);

  // Load scene from server
  const loadScene = useCallback(async () => {
    if (!excalidrawAPI) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/canvas/excalidraw?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        throw new Error('Failed to load canvas scene.');
      }
      const body = (await response.json()) as { scene: { elements: CanvasShape[] } };
      const shapes = body.scene?.elements ?? [];

      // Create a hash to detect changes
      const shapesWithFileIds = shapes.map((shape) => ({
        ...shape,
        fileId: shape.fileId && shape.fileId.length > 0 ? shape.fileId : shape.id,
      }));

      const elementsHash = hashShapes(shapesWithFileIds);
      if (elementsHash === lastFetchedHash.current) {
        setIsLoading(false);
        return;
      }
      lastFetchedHash.current = elementsHash;
      serverShapesRef.current = new Map(shapesWithFileIds.map((shape) => [shape.id, shape]));

      // Convert shapes to Excalidraw format
      const filesToAdd: BinaryFiles = {};

      const excalidrawElements = shapesWithFileIds.map((shape) => {
        const fileId = shape.fileId ?? shape.id;
        const base: any = {
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          width: shape.width ?? 100,
          height: shape.height ?? 100,
          angle: ((shape.rotation ?? 0) * Math.PI) / 180,
          strokeColor: shape.strokeColor ?? '#1e1e1e',
          backgroundColor: shape.backgroundColor ?? 'transparent',
          fillStyle: shape.fillStyle ?? 'solid',
          strokeWidth: shape.strokeWidth ?? 2,
          strokeStyle: 'solid',
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: shape.roundness ? { type: 3 } : null,
          seed: stableSeed(shape.id),
          version: 1,
          versionNonce: stableSeed(`${shape.id}-nonce`),
          isDeleted: false,
          boundElements: [],
          updated: Date.now(),
          link: null,
          locked: false,
        };

        // Handle text elements
        if (shape.type === 'text' || shape.type === 'label') {
          return {
            ...base,
            type: 'text',
            text: shape.text ?? '',
            fontSize: shape.fontSize ?? 20,
            fontFamily: 1,
            textAlign: 'left',
            verticalAlign: 'top',
            baseline: 18,
            containerId: null,
            originalText: shape.text ?? '',
            lineHeight: 1.25,
          };
        }

        // Handle arrow/line elements
        if (shape.type === 'arrow' || shape.type === 'line') {
          const points = (shape.points && shape.points.length > 0)
            ? shape.points
            : [[shape.width ?? 100, shape.height ?? 100]];
          return {
            ...base,
            points,
            lastCommittedPoint: null,
            startBinding: null,
            endBinding: null,
            startArrowhead: null,
            endArrowhead: shape.type === 'arrow' ? 'arrow' : null,
          };
        }

        // Handle freedraw
        if (shape.type === 'freedraw') {
          return {
            ...base,
            points: shape.points ?? [[0, 0]],
            pressures: [],
            simulatePressure: true,
            lastCommittedPoint: null,
          };
        }

        // Handle image
        if (shape.type === 'image') {
          const parsed = shape.src ? parseDataUrl(shape.src) : null;
          if (shape.src && parsed) {
            const fileData: BinaryFileData = {
              id: fileId,
              mimeType: parsed.mimeType as BinaryFileData['mimeType'],
              dataURL: shape.src,
              created: Date.now(),
              lastRetrieved: Date.now(),
            };
            filesToAdd[fileId] = fileData;
          }

          const imageElement: Partial<ExcalidrawImageElement> = {
            type: 'image',
            fileId,
            status: 'saved',
            scale: [1, 1],
          };

          return {
            ...base,
            ...imageElement,
          };
        }

        // Default (rectangle, ellipse, diamond)
        return base;
      });

      isUpdatingFromServer.current = true;
      if (Object.keys(filesToAdd).length > 0) {
        excalidrawAPI.addFiles(filesToAdd, true);
      }
      excalidrawAPI.updateScene({
        elements: excalidrawElements,
        appState: {
          selectedElementIds: {},
          selectedGroupIds: {},
          editingElement: null,
          draggingElement: null,
          resizingElement: null,
        },
      });
      window.setTimeout(() => {
        isUpdatingFromServer.current = false;
      }, 0);
    } catch (err) {
      isUpdatingFromServer.current = false;
      setError(err instanceof Error ? err.message : 'Unknown error loading canvas scene');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, excalidrawAPI]);

  // Poll for updates from server every 3 seconds
  useEffect(() => {
    if (!excalidrawAPI) return;

    loadScene();
    const interval = setInterval(loadScene, 3000);
    return () => clearInterval(interval);
  }, [excalidrawAPI, loadScene]);

  const syncPendingChanges = useCallback(async () => {
    const elements = pendingElementsRef.current;
    pendingElementsRef.current = null;
    clearSyncTimer();

    if (!elements || elements.length === 0) {
      return;
    }

    const additions: ExcalidrawElementPayload[] = [];
    const updates: ExcalidrawOperation[] = [];
    const nextShapeMap = new Map<string, CanvasShape>();

    elements.forEach((element) => {
      if (!element || element.isDeleted) {
        return;
      }

      const shape = toCanvasShape(element);
      if (shape.type === 'image') {
        const existing = serverShapesRef.current.get(shape.id);
        if (!shape.src && existing?.src) {
          shape.src = existing.src;
        }
        if (!shape.fileId && existing?.fileId) {
          shape.fileId = existing.fileId;
        }
        if (!shape.fileId) {
          shape.fileId = shape.id;
        }
      }
      if (!shape.fileId) {
        shape.fileId = shape.id;
      }
      nextShapeMap.set(shape.id, shape);

      const previous = serverShapesRef.current.get(shape.id);
      if (!previous) {
        additions.push(toElementPayload(shape));
        return;
      }

      const diff = diffShape(previous, shape);
      if (diff) {
        updates.push({ kind: 'update_element', id: shape.id, props: diff });
      }
    });

    const removals: ExcalidrawOperation[] = [];
    serverShapesRef.current.forEach((_shape, id) => {
      if (!nextShapeMap.has(id)) {
        removals.push({ kind: 'remove_element', id });
      }
    });

    const operations: ExcalidrawOperation[] = [];
    if (additions.length > 0) {
      operations.push({ kind: 'add_elements', elements: additions });
    }
    operations.push(...updates, ...removals);

    if (operations.length === 0) {
      serverShapesRef.current = nextShapeMap;
      lastFetchedHash.current = hashShapes(Array.from(nextShapeMap.values()));
      return;
    }

    try {
      await postCanvasCommands({
        sessionId,
        commands: [
          {
            id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            type: 'excalidraw.patch',
            payload: {
              summary: 'Synced user edits from Excalidraw.',
              operations,
            },
            issuedAt: Date.now(),
            issuedBy: 'user',
          },
        ],
      });
      serverShapesRef.current = nextShapeMap;
      lastFetchedHash.current = hashShapes(Array.from(nextShapeMap.values()));
      setError(null);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Failed to sync canvas edits');
    }
  }, [clearSyncTimer, sessionId]);

  const scheduleSync = useCallback(() => {
    clearSyncTimer();
    syncTimerRef.current = window.setTimeout(syncPendingChanges, 350);
  }, [clearSyncTimer, syncPendingChanges]);

  // Handle user changes in the editor
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (isUpdatingFromServer.current) return;
      if (appState.draggingElement || appState.resizingElement || appState.editingElement) {
        pendingElementsRef.current = elements;
        scheduleSync();
        return;
      }

      pendingElementsRef.current = elements;
      scheduleSync();
    },
    [scheduleSync]
  );

  return (
    <article style={{ padding: '1.5rem', borderRadius: '1rem', background: '#0f172a', display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Canvas Preview</h2>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          Draw freely or ask the agent to add shapes. The canvas syncs with agent-generated diagrams.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={loadScene}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
            background: 'transparent',
            color: '#e2e8f0',
            cursor: isLoading ? 'progress' : 'pointer',
          }}
          disabled={isLoading}
        >
          Refresh Canvas
        </button>
      </div>

      {error ? <p style={{ color: '#f97316' }}>{error}</p> : null}

      <div style={{ height: '600px', border: '1px solid #1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          theme="dark"
          initialData={{
            elements: [],
            appState: {
              viewBackgroundColor: '#0f172a',
            },
          }}
        />
      </div>
    </article>
  );
}
