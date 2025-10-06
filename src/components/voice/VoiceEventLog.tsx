'use client';

import type { CSSProperties, MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

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

export function VoiceEventLog({
  transcripts,
  events,
}: {
  transcripts: TranscriptLine[];
  events: VoiceDebugEvent[];
}) {
  const hasTranscript = transcripts.length > 0;
  const hasEvents = events.length > 0;
  const transcriptWindowRef = useRef<Window | null>(null);
  const eventsWindowRef = useRef<Window | null>(null);

  const escapeHtml = useCallback((value: string) => (
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  ), []);

  const escapeAttribute = useCallback((value: string) => (
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  ), []);

  const transcriptHtml = useMemo(() => {
    if (!hasTranscript) {
      return '<p>No transcript has been recorded for this session yet.</p>';
    }

    const entries = transcripts
      .map((line, index) => {
        const badge = escapeHtml(line.speaker.toUpperCase());
        const body = escapeHtml(line.text);
        return `
          <article class="entry entry--${escapeHtml(line.speaker)}">
            <header>
              <span class="entry__index">#${index + 1}</span>
              <span class="entry__speaker">${badge}</span>
            </header>
            <p>${body.replace(/\n/g, '<br />')}</p>
          </article>
        `;
      })
      .join('\n');

    return `
      <section>
        <h1>Voice Transcript</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <div class="entries">
          ${entries}
        </div>
      </section>
    `;
  }, [escapeHtml, hasTranscript, transcripts]);

  const eventsHtml = useMemo(() => {
    if (!hasEvents) {
      return '<p>No realtime events captured for this session.</p>';
    }

    const entries = events
      .map((event) => {
        const timestamp = new Date(event.timestamp).toLocaleString();
        const type = escapeHtml(event.type);

        const labelContent = (() => {
          const isImage = event.type.endsWith('.image') || event.label.startsWith('data:image');
          if (isImage) {
            const src = escapeAttribute(event.label);
            return `<figure class="event__image"><img src="${src}" alt="${type} diagram" /></figure>`;
          }

          try {
            const parsed = JSON.parse(event.label);
            return `<pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
          } catch (error) {
            return `<pre>${escapeHtml(event.label)}</pre>`;
          }
        })();

        return `
          <article class="event">
            <header>
              <span class="event__type">${type}</span>
              <span class="event__timestamp">${escapeHtml(timestamp)}</span>
            </header>
            ${labelContent}
          </article>
        `;
      })
      .join('\n');

    return `
      <section>
        <h1>Realtime Events</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <div class="events">
          ${entries}
        </div>
      </section>
    `;
  }, [escapeAttribute, escapeHtml, events, hasEvents]);

  const popupStyles = useMemo(
    () => `body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1 { margin-top: 0; }
    a { color: #38bdf8; }
    .entries, .events { display: grid; gap: 1rem; }
    .entry, .event { background: #020617; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 1rem; }
    .entry__index { font-size: 0.75rem; color: #38bdf8; margin-right: 0.5rem; }
    .entry__speaker { font-size: 0.75rem; letter-spacing: 0.08em; }
    .event__type { color: #38bdf8; margin-right: 0.5rem; }
    .event__timestamp { color: #94a3b8; font-size: 0.85rem; }
    pre { background: #0f172a; border-radius: 0.5rem; padding: 0.75rem; overflow-x: auto; }
    img { max-width: 100%; border-radius: 0.5rem; border: 1px solid #1e293b; }`,
    [],
  );

  const ensurePopupWindow = useCallback(
    (ref: MutableRefObject<Window | null>, title: string) => {
      let popup = ref.current;
      if (!popup || popup.closed) {
        popup = window.open('', '_blank', 'popup=yes,width=900,height=720,resizable=yes,scrollbars=yes');
        if (!popup) {
          return null;
        }
        try {
          popup.opener = null;
        } catch (error) {
          // Some browsers disallow mutating opener; ignore safely.
        }
        popup.document.open();
        popup.document.write(`<!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <title>${escapeHtml(title)}</title>
              <style>${popupStyles}</style>
            </head>
            <body>
              <main id="content"></main>
            </body>
          </html>`);
        popup.document.close();
        ref.current = popup;
      } else {
        popup.focus();
        popup.document.title = title;
      }
      return popup;
    },
    [escapeHtml, popupStyles],
  );

  const updatePopupContent = useCallback(
    (ref: MutableRefObject<Window | null>, title: string, html: string) => {
      const popup = ensurePopupWindow(ref, title);
      if (!popup) {
        return;
      }
      const container = popup.document.getElementById('content');
      if (!container) {
        return;
      }
      container.innerHTML = html;
    },
    [ensurePopupWindow],
  );

  const closePopupIfNeeded = useCallback((ref: MutableRefObject<Window | null>) => {
    if (ref.current && ref.current.closed) {
      ref.current = null;
    }
  }, []);

  const handleOpenTranscript = useCallback(() => {
    if (!hasTranscript) {
      return;
    }
    updatePopupContent(transcriptWindowRef, 'Voice Transcript', transcriptHtml);
  }, [hasTranscript, transcriptHtml, updatePopupContent]);

  const handleOpenEvents = useCallback(() => {
    if (!hasEvents) {
      return;
    }
    updatePopupContent(eventsWindowRef, 'Realtime Events', eventsHtml);
  }, [eventsHtml, hasEvents, updatePopupContent]);

  useEffect(() => {
    closePopupIfNeeded(transcriptWindowRef);
    if (transcriptWindowRef.current) {
      updatePopupContent(transcriptWindowRef, 'Voice Transcript', transcriptHtml);
    }
  }, [closePopupIfNeeded, transcriptHtml, updatePopupContent]);

  useEffect(() => {
    closePopupIfNeeded(eventsWindowRef);
    if (eventsWindowRef.current) {
      updatePopupContent(eventsWindowRef, 'Realtime Events', eventsHtml);
    }
  }, [closePopupIfNeeded, eventsHtml, updatePopupContent]);

  return (
    <article style={containerStyle}>
      <header>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Session Logs</h2>
        <p style={{ color: '#94a3b8', margin: 0 }}>
          Access the live transcript and realtime events in separate tabs so the dashboard stays focused.
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={handleOpenTranscript}
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid #1e293b',
            background: hasTranscript ? '#1d4ed8' : '#1e293b',
            color: '#e2e8f0',
            cursor: hasTranscript ? 'pointer' : 'not-allowed',
          }}
          disabled={!hasTranscript}
        >
          {hasTranscript ? 'Open Transcript' : 'Transcript Unavailable'}
        </button>

        <button
          type="button"
          onClick={handleOpenEvents}
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid #1e293b',
            background: hasEvents ? '#0ea5e9' : '#1e293b',
            color: '#0f172a',
            cursor: hasEvents ? 'pointer' : 'not-allowed',
          }}
          disabled={!hasEvents}
        >
          {hasEvents ? 'Open Realtime Events' : 'Events Unavailable'}
        </button>
      </div>
    </article>
  );
}
