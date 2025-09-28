'use client';

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { clearCanvasCommands, fetchCanvasCommands, postCanvasCommands } from '@/lib/canvas/client';
import type { CanvasCommand } from '@/lib/canvas/types';

const panelStyle: CSSProperties = {
  padding: '1.5rem',
  borderRadius: '1rem',
  background: '#1e293b',
  display: 'grid',
  gap: '1rem',
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
};

const badgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  background: '#0f172a',
  borderRadius: '999px',
  padding: '0.1rem 0.75rem',
  textTransform: 'uppercase',
};

const sessionId = 'primary-session';

function buildSampleCommand(): CanvasCommand {
  return {
    id: `cmd_${Date.now()}`,
    sessionId,
    type: 'mermaid.update',
    payload: {
      diagram: 'graph TD\n  Voice --> Canvas\n  Canvas --> Deployment',
      focus: 'Voice',
    },
    issuedAt: Date.now(),
    issuedBy: 'system',
  };
}

export function CanvasCommandPanel() {
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchCanvasCommands(sessionId);
      setCommands(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load canvas commands.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendSample = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const command = buildSampleCommand();
      await postCanvasCommands({ sessionId, commands: [command] });
      setCommands((prev) => [...prev, command]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send command.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await clearCanvasCommands(sessionId);
      setCommands([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear commands.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Processing…';
    if (commands.length === 0) return 'No canvas commands recorded yet.';
    return `${commands.length} command${commands.length === 1 ? '' : 's'} captured.`;
  }, [commands.length, isLoading]);

  return (
    <article style={panelStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Canvas Command Bridge</h2>
        <p style={{ margin: 0 }}>
          Voice agent tool calls will be translated into structured commands for the digital canvas
          service. Use the controls below to simulate those commands until the realtime hand-off is wired.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={sendSample}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: '#22d3ee',
            color: '#0f172a',
            fontWeight: 600,
            cursor: isLoading ? 'progress' : 'pointer',
          }}
          disabled={isLoading}
        >
          Send Sample Diagram Command
        </button>

        <button
          type="button"
          onClick={refresh}
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
          Refresh
        </button>

        <button
          type="button"
          onClick={clearAll}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid #ef4444',
            background: 'transparent',
            color: '#ef4444',
            cursor: isLoading ? 'progress' : 'pointer',
          }}
          disabled={isLoading || commands.length === 0}
        >
          Clear
        </button>
      </div>

      <p style={{ color: '#94a3b8' }}>{statusLabel}</p>
      {error ? <p style={{ color: '#f97316' }}>{error}</p> : null}

      <div style={listStyle}>
        {commands.map((command) => (
          <div
            key={command.id}
            style={{
              background: '#0f172a',
              borderRadius: '0.75rem',
              padding: '0.9rem 1rem',
              border: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={badgeStyle}>{command.type}</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {new Date(command.issuedAt).toLocaleTimeString()}
              </span>
            </div>
            <pre
              style={{
                fontSize: '0.9rem',
                margin: 0,
                overflowX: 'auto',
                background: '#020617',
                padding: '0.75rem',
                borderRadius: '0.5rem',
              }}
            >
              {JSON.stringify(command.payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </article>
  );
}
