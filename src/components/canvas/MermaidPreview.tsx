'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

const wrapperStyle: CSSProperties = {
  background: '#0f172a',
  borderRadius: '1rem',
  padding: '1.5rem',
  display: 'grid',
  gap: '1rem',
};

const iframeStyle: CSSProperties = {
  width: '100%',
  height: '320px',
  border: '1px solid #1e293b',
  borderRadius: '0.75rem',
  background: '#020617',
};

export function MermaidPreview({ sessionId }: { sessionId: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/canvas/render?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Failed to load Mermaid render.');
      }

      const payload = (await response.json()) as {
        svg: string | null;
        diagram: string | null;
        title?: string | null;
        focus?: string | null;
        error?: string | null;
      };

      setSvg(payload.svg);
      setDiagram(payload.diagram ?? null);
      setTitle(payload.title ?? null);
      setFocus(payload.focus ?? null);
      setRenderError(payload.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading Mermaid render');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  return (
    <article style={wrapperStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Mermaid Preview</h2>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          View the latest Mermaid diagram issued during this session. Refresh after the agent updates the
          canvas to pull the newest render.
        </p>
      </header>

      <div>
        <button
          type="button"
          onClick={loadPreview}
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
          Refresh Preview
        </button>
      </div>

      {error ? <p style={{ color: '#f97316' }}>{error}</p> : null}
      {renderError ? <p style={{ color: '#f97316' }}>{renderError}</p> : null}

      {svg ? (
        <iframe
          style={iframeStyle}
          srcDoc={`<!DOCTYPE html><html><body style="margin:0;background:#020617;color:#e2e8f0;">${svg}</body></html>`}
          title="Mermaid preview"
        />
      ) : (
        <div
          style={{
            ...iframeStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
        >
          {isLoading
            ? 'Loading latest Mermaid diagram…'
            : renderError
              ? 'Unable to render the latest diagram.'
              : 'No Mermaid commands recorded yet.'}
        </div>
      )}

      {title ? <p style={{ margin: 0, color: '#e2e8f0' }}><strong>Title:</strong> {title}</p> : null}
      {focus ? <p style={{ margin: 0, color: '#94a3b8' }}><strong>Focus:</strong> {focus}</p> : null}

      {diagram ? (
        <pre
          style={{
            margin: 0,
            background: '#020617',
            padding: '1rem',
            borderRadius: '0.75rem',
            overflowX: 'auto',
            color: '#e2e8f0',
            fontSize: '0.9rem',
          }}
        >
          {diagram}
        </pre>
      ) : null}
    </article>
  );
}
