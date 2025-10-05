'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import '@excalidraw/excalidraw/index.css';

function stableSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
import type { CanvasShape } from '@/lib/canvas/excalidrawState';

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

export function ExcalidrawEditor({ sessionId }: { sessionId: string }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedHash = useRef<string>('');
  const isUpdatingFromServer = useRef(false);

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
      const elementsHash = JSON.stringify(shapes.map(s => s.id));
      if (elementsHash === lastFetchedHash.current) {
        setIsLoading(false);
        return;
      }
      lastFetchedHash.current = elementsHash;

      // Convert shapes to Excalidraw format
      const excalidrawElements = shapes.map((shape) => {
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
          return {
            ...base,
            type: 'rectangle',
            backgroundColor: shape.backgroundColor ?? '#64748b',
          };
        }

        // Default (rectangle, ellipse, diamond)
        return base;
      });

      isUpdatingFromServer.current = true;
      excalidrawAPI.updateScene({
        elements: excalidrawElements,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading canvas scene');
    } finally {
      setIsLoading(false);
      isUpdatingFromServer.current = false;
    }
  }, [sessionId, excalidrawAPI]);

  // Poll for updates from server every 3 seconds
  useEffect(() => {
    if (!excalidrawAPI) return;

    loadScene();
    const interval = setInterval(loadScene, 3000);
    return () => clearInterval(interval);
  }, [excalidrawAPI, loadScene]);

  // Handle user changes in the editor
  const handleChange = useCallback(
    (elements: readonly any[]) => {
      if (isUpdatingFromServer.current) return;
      // User is drawing - we let them draw freely
      // Agent updates will merge in via polling
    },
    []
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
