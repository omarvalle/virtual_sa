import type { CSSProperties } from 'react';
import { VoiceSessionPanel } from '@/components/voice/VoiceSessionPanel';
import { ExcalidrawEditor } from '@/components/canvas/ExcalidrawEditor';

const containerStyle: CSSProperties = {
  padding: '3rem',
  maxWidth: 960,
  margin: '0 auto',
};

export default function HomePage() {
  return (
    <main style={containerStyle}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.75rem', marginBottom: '0.5rem' }}>Virtual Solutions Architect</h1>
      </header>

      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <VoiceSessionPanel />
        <ExcalidrawEditor sessionId="primary-session" />
      </section>
    </main>
  );
}
