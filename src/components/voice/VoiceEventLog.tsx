'use client';

import type { CSSProperties } from 'react';

export type TranscriptLine = {
  id: string;
  speaker: 'user' | 'assistant' | 'system';
  text: string;
};

export type VoiceDebugEvent = {
  id: string;
  type: string;
  label: string;
  timestamp: number;
};

const containerStyle: CSSProperties = {
  padding: '1.5rem',
  borderRadius: '1rem',
  background: '#0f172a',
  display: 'grid',
  gap: '1rem',
};

const transcriptListStyle: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
};

const debugListStyle: CSSProperties = {
  fontSize: '0.85rem',
  whiteSpace: 'pre-wrap',
  display: 'grid',
  gap: '0.25rem',
};

export function VoiceEventLog({
  transcripts,
  events,
}: {
  transcripts: TranscriptLine[];
  events: VoiceDebugEvent[];
}) {
  const renderEventLabel = (event: VoiceDebugEvent) => {
    const isImage = event.type.endsWith('.image') || event.label.startsWith('data:image');
    if (isImage) {
      return (
        <img
          src={event.label}
          alt="Generated diagram"
          style={{ maxWidth: '100%', borderRadius: '0.5rem', marginTop: '0.5rem', border: '1px solid #1e293b' }}
        />
      );
    }

    try {
      const parsed = JSON.parse(event.label);
      return (
        <pre style={{ margin: 0 }}>{JSON.stringify(parsed, null, 2)}</pre>
      );
    } catch (error) {
      return <div>{event.label}</div>;
    }
  };

  return (
    <article style={containerStyle}>
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Live Transcript</h2>
        {transcripts.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Talk to the agent to populate the transcript.</p>
        ) : (
          <div style={transcriptListStyle}>
            {transcripts.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: entry.speaker === 'assistant' ? '#1d4ed8' : '#0f172a',
                  border: entry.speaker === 'assistant' ? 'none' : '1px solid #1e293b',
                }}
              >
                <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', display: 'block' }}>
                  {entry.speaker.toUpperCase()}
                </span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Realtime Events</h3>
        {events.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Control-channel events will appear here for debugging.</p>
        ) : (
          <div style={debugListStyle}>
            {events.map((event) => (
              <div key={event.id}>
                <strong style={{ color: '#22d3ee' }}>{event.type}</strong>
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                {renderEventLabel(event)}
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
