'use client';

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasShape } from '@/lib/canvas/excalidrawState';
import type { ExcalidrawPoint } from '@/lib/canvas/types';
import { postCanvasCommands } from '@/lib/canvas/client';

const wrapperStyle: CSSProperties = {
  background: '#0f172a',
  borderRadius: '1rem',
  padding: '1.5rem',
  display: 'grid',
  gap: '1rem',
};

function computeDimensions(points: ExcalidrawPoint[] | undefined): { width: number; height: number } {
  if (!points || points.length === 0) {
    return { width: 0, height: 0 };
  }

  const xs = [0, ...points.map((point) => point[0])];
  const ys = [0, ...points.map((point) => point[1])];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    width: Math.max(1, Math.abs(maxX - minX)),
    height: Math.max(1, Math.abs(maxY - minY)),
  };
}

export function ExcalidrawPreview({ sessionId }: { sessionId: string }) {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<
    | {
        kind: 'move';
        id: string;
        offsetX: number;
        offsetY: number;
      }
    | {
        kind: 'resize-start';
        id: string;
        originX: number;
        originY: number;
        originalPoints: ExcalidrawPoint[];
      }
    | {
        kind: 'resize-end';
        id: string;
        originalPoints: ExcalidrawPoint[];
      }
    | {
        kind: 'resize-corner';
        id: string;
        originX: number;
        originY: number;
        initialWidth: number;
        initialHeight: number;
        aspectRatio: number;
      }
    | null
  >(null);
  const shapesRef = useRef<CanvasShape[]>([]);

  const loadScene = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/canvas/excalidraw?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Failed to load canvas scene.');
      }
      const body = (await response.json()) as { scene: { elements: CanvasShape[] } };
      setShapes(body.scene?.elements ?? []);
      setActiveShapeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading canvas scene');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadScene();
  }, [loadScene]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  const persistShape = useCallback(
    async (shape: CanvasShape) => {
      try {
        const props: Record<string, unknown> = {
          x: shape.x,
          y: shape.y,
        };

        if (typeof shape.width === 'number') {
          props.width = shape.width;
        }
        if (typeof shape.height === 'number') {
          props.height = shape.height;
        }
        if (shape.points) {
          props.points = shape.points;
        }
        if (shape.src) {
          props.src = shape.src;
        }

        await postCanvasCommands({
          sessionId,
          commands: [
            {
              id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              sessionId,
              type: 'excalidraw.patch',
              payload: {
                summary: `Updated ${shape.type}`,
                operations: [
                  {
                    kind: 'update_element',
                    id: shape.id,
                    props,
                  },
                ],
              },
              issuedAt: Date.now(),
              issuedBy: 'user',
            },
          ],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to persist canvas update.');
      }
    },
    [sessionId],
  );

  const getSvgCoordinates = useCallback((event: PointerEvent | ReactPointerEvent<Element>) => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: event.clientX, y: event.clientY };
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return { x: event.clientX, y: event.clientY };
    }
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const coords = getSvgCoordinates(event);

      if (dragState.kind === 'move') {
        const nextX = coords.x - dragState.offsetX;
        const nextY = coords.y - dragState.offsetY;
        setShapes((prev) => {
          const updated = prev.map((shape) =>
            shape.id === dragState.id
              ? {
                  ...shape,
                  x: nextX,
                  y: nextY,
                }
              : shape,
          );
          shapesRef.current = updated;
          return updated;
        });
        return;
      }

      if (dragState.kind === 'resize-end') {
        setShapes((prev) => {
          const updated = prev.map((shape) => {
            if (shape.id !== dragState.id) {
              return shape;
            }

            const baseX = shape.x;
            const baseY = shape.y;
            const updatedPoints = [...(shape.points ?? dragState.originalPoints)];
            if (updatedPoints.length === 0) {
              updatedPoints.push([coords.x - baseX, coords.y - baseY]);
            } else {
              updatedPoints[updatedPoints.length - 1] = [coords.x - baseX, coords.y - baseY];
            }

            const dimensions = computeDimensions(updatedPoints);

            const nextShape = {
              ...shape,
              points: updatedPoints,
              width: dimensions.width,
              height: dimensions.height,
            };
            return nextShape;
          });
          shapesRef.current = updated;
          return updated;
        });
        return;
      }

      if (dragState.kind === 'resize-start') {
        setShapes((prev) => {
          const updated = prev.map((shape) => {
            if (shape.id !== dragState.id) {
              return shape;
            }

            const deltaX = coords.x - dragState.originX;
            const deltaY = coords.y - dragState.originY;
            const updatedPoints = dragState.originalPoints.map(([px, py]) => [px - deltaX, py - deltaY]) as ExcalidrawPoint[];
            const dimensions = computeDimensions(updatedPoints);

            const nextShape = {
              ...shape,
              x: coords.x,
              y: coords.y,
              points: updatedPoints,
              width: dimensions.width,
              height: dimensions.height,
            };
            return nextShape;
          });
          shapesRef.current = updated;
          return updated;
        });
        return;
      }

      if (dragState.kind === 'resize-corner') {
        setShapes((prev) => {
          const updated = prev.map((shape) => {
            if (shape.id !== dragState.id) {
              return shape;
            }

            const deltaX = Math.max(1, coords.x - dragState.originX);
            const deltaY = Math.max(1, coords.y - dragState.originY);
            let nextWidth = deltaX;
            let nextHeight = deltaY;

            if (dragState.aspectRatio > 0) {
              nextHeight = Math.max(1, Math.round(nextWidth / dragState.aspectRatio));
            }

            return {
              ...shape,
              width: nextWidth,
              height: nextHeight,
            };
          });
          shapesRef.current = updated;
          return updated;
        });
      }
    },
    [getSvgCoordinates],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }
      dragStateRef.current = null;
      setActiveShapeId(null);

      const latestShape = shapesRef.current.find((shape) => shape.id === dragState.id);
      if (latestShape) {
        void persistShape(latestShape);
      }
    },
    [persistShape],
  );

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const startMove = useCallback(
    (shape: CanvasShape, event: ReactPointerEvent<SVGGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const coords = getSvgCoordinates(event.nativeEvent);
      dragStateRef.current = {
        kind: 'move',
        id: shape.id,
        offsetX: coords.x - shape.x,
        offsetY: coords.y - shape.y,
      };
      setActiveShapeId(shape.id);
      setError(null);
    },
    [getSvgCoordinates],
  );

  const startHandleDrag = useCallback(
    (shape: CanvasShape, handle: 'start' | 'end' | 'corner', event: ReactPointerEvent<SVGCircleElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const points = shape.points ?? [[shape.width ?? 0, shape.height ?? 0]];
      if (handle === 'start') {
        dragStateRef.current = {
          kind: 'resize-start',
          id: shape.id,
          originX: shape.x,
          originY: shape.y,
          originalPoints: points.map(([px, py]) => [px, py]) as ExcalidrawPoint[],
        };
      } else if (handle === 'end') {
        dragStateRef.current = {
          kind: 'resize-end',
          id: shape.id,
          originalPoints: points.map(([px, py]) => [px, py]) as ExcalidrawPoint[],
        };
      } else {
        dragStateRef.current = {
          kind: 'resize-corner',
          id: shape.id,
          originX: shape.x,
          originY: shape.y,
          initialWidth: shape.width ?? 1,
          initialHeight: shape.height ?? 1,
          aspectRatio:
            shape.type === 'image' && shape.width && shape.height && shape.height !== 0
              ? (shape.width as number) / (shape.height as number)
              : 0,
        };
      }
      setActiveShapeId(shape.id);
      setError(null);
    },
    [],
  );

  const renderShape = useCallback(
    (shape: CanvasShape) => {
      const {
        id,
        type,
        x,
        y,
        width,
        height,
        strokeColor,
        backgroundColor,
        strokeWidth,
        rotation,
        text,
        points,
      } = shape;
      const transform = rotation ? `rotate(${rotation}, ${x + width / 2}, ${y + height / 2})` : undefined;
      const isActive = activeShapeId === id;
      const commonProps = {
        stroke: strokeColor,
        fill: backgroundColor ?? 'transparent',
        strokeWidth,
        transform,
      };

      const toAbsolutePoints = (pts: ExcalidrawPoint[] | undefined) =>
        (pts ?? []).map(([px, py]) => `${x + px},${y + py}`).join(' ');

      switch (type) {
        case 'rectangle':
          return (
            <rect
              key={id}
              x={x}
              y={y}
              width={width}
              height={height}
              rx={shape.roundness ?? 8}
              {...commonProps}
            />
          );
        case 'ellipse':
          return (
            <ellipse
              key={id}
              cx={x + width / 2}
              cy={y + height / 2}
              rx={width / 2}
              ry={height / 2}
              {...commonProps}
            />
          );
        case 'diamond':
          return (
            <polygon
              key={id}
              points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`}
              {...commonProps}
            />
          );
        case 'arrow':
        case 'line': {
          const ensuredPoints = points && points.length > 0 ? points : [[width, height]];
          const abs = toAbsolutePoints(ensuredPoints);
          const start = { x, y };
          const lastPoint = ensuredPoints[ensuredPoints.length - 1];
          const end = { x: x + lastPoint[0], y: y + lastPoint[1] };

          return (
            <g key={id}>
              <polyline
                points={abs}
                fill="none"
                strokeLinecap="round"
                {...commonProps}
                markerEnd={type === 'arrow' ? 'url(#arrowhead)' : undefined}
              />
              <circle
                cx={start.x}
                cy={start.y}
                r={6}
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={2}
                onPointerDown={(event) => startHandleDrag(shape, 'start', event)}
              />
              <circle
                cx={end.x}
                cy={end.y}
                r={6}
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={2}
                onPointerDown={(event) => startHandleDrag(shape, 'end', event)}
              />
            </g>
          );
        }
        case 'freedraw': {
          const abs = toAbsolutePoints(points);
          return <polyline key={id} points={abs} fill="none" {...commonProps} strokeLinecap="round" />;
        }
        case 'image':
          if (!shape.src) {
            return null;
          }
          return (
            <image
              key={id}
              href={shape.src}
              x={x}
              y={y}
              width={Math.max(1, width)}
              height={Math.max(1, height)}
              preserveAspectRatio="xMidYMid meet"
              transform={transform}
            />
          );
        case 'text':
        case 'label': {
          const fontSize = shape.fontSize ?? height;
          const fontFamily = shape.fontFamily ?? 'inherit';
          return (
            <text
              key={id}
              x={x}
              y={y + fontSize}
              fill={strokeColor}
              fontSize={fontSize}
              fontFamily={fontFamily}
              transform={transform}
            >
              {text ?? ''}
            </text>
          );
        }
        default:
          return null;
      }
    },
    [activeShapeId, startHandleDrag],
  );

  return (
    <article style={wrapperStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Canvas Preview</h2>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          Shows the latest shapes placed on the collaborative canvas. Ask the agent to add shapes (e.g.,
          &quot;draw a square&quot;) and refresh to view updates.
        </p>
      </header>

      <div>
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

      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        style={{
          width: '100%',
          height: '320px',
          border: '1px solid #1e293b',
          borderRadius: '0.75rem',
          background: '#020617',
          cursor: activeShapeId ? 'grabbing' : 'grab',
        }}
        role="img"
        aria-label="Canvas preview"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            fill="#22d3ee"
          >
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
        </defs>
        {shapes.map((shape) => (
          <g
            key={shape.id}
            onPointerDown={(event) => startMove(shape, event)}
            style={{ cursor: activeShapeId === shape.id ? 'grabbing' : 'grab' }}
          >
            {renderShape(shape)}
            {activeShapeId === shape.id ? (
              <rect
                x={shape.x - 4}
                y={shape.y - 4}
                width={(shape.width ?? 0) + 8}
                height={(shape.height ?? 0) + 8}
                fill="none"
                stroke="#38bdf8"
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
            {shape.type === 'image' ? (
              <circle
                cx={(shape.x ?? 0) + Math.max(8, shape.width ?? 0)}
                cy={(shape.y ?? 0) + Math.max(8, shape.height ?? 0)}
                r={8}
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={2}
                onPointerDown={(event) => startHandleDrag(shape, 'corner', event)}
              />
            ) : null}
          </g>
        ))}
      </svg>

      {shapes.length === 0 ? (
        <p style={{ color: '#94a3b8', margin: 0 }}>No shapes have been drawn yet.</p>
      ) : null}
    </article>
  );
}
