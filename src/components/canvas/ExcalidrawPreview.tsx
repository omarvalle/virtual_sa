'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CanvasShape } from '@/lib/canvas/excalidrawState';

const wrapperStyle: CSSProperties = {
  background: '#0f172a',
  borderRadius: '1rem',
  padding: '1.5rem',
  display: 'grid',
  gap: '1rem',
};

const canvasStyle: CSSProperties = {
  width: '100%',
  height: '320px',
  border: '1px solid #1e293b',
  borderRadius: '0.75rem',
  background: '#020617',
};

function renderShape(shape: CanvasShape) {
  const { id, type, x, y, width, height, strokeColor, backgroundColor, strokeWidth, rotation, text } = shape;
  const transform = rotation ? `rotate(${rotation}, ${x + width / 2}, ${y + height / 2})` : undefined;

  switch (type) {
    case 'rectangle':
      return (
        <rect
          key={id}
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={strokeColor}
          fill={backgroundColor ?? 'transparent'}
          strokeWidth={strokeWidth}
          transform={transform}
          rx={shape.roundness ?? 8}
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
          stroke={strokeColor}
          fill={backgroundColor ?? 'transparent'}
          strokeWidth={strokeWidth}
          transform={transform}
        />
      );
    case 'diamond':
      return (
        <polygon
          key={id}
          points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`}
          stroke={strokeColor}
          fill={backgroundColor ?? 'transparent'}
          strokeWidth={strokeWidth}
          transform={transform}
        />
      );
    case 'arrow':
      return (
        <line
          key={id}
          x1={x}
          y1={y}
          x2={x + width}
          y2={y + height}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          markerEnd="url(#arrowhead)"
          transform={transform}
        />
      );
    case 'text':
      return (
        <text
          key={id}
          x={x}
          y={y + height}
          fill={strokeColor}
          fontSize={height}
          transform={transform}
        >
          {text ?? ''}
        </text>
      );
    default:
      return null;
  }
}

export function ExcalidrawPreview({ sessionId }: { sessionId: string }) {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading canvas scene');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadScene();
  }, [loadScene]);

  return (
    <article style={wrapperStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Canvas Preview</h2>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          Shows the latest shapes placed on the collaborative canvas. Ask the agent to add shapes (e.g.,
          "draw a square") and refresh to view updates.
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

      <svg viewBox="0 0 800 400" style={canvasStyle} role="img" aria-label="Canvas preview">
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
        {shapes.map((shape) => renderShape(shape))}
      </svg>

      {shapes.length === 0 ? (
        <p style={{ color: '#94a3b8', margin: 0 }}>No shapes have been drawn yet.</p>
      ) : null}
    </article>
  );
}
