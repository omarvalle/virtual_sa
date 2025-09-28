import type { CSSProperties } from 'react';
import { VoiceSessionPanel } from '@/components/voice/VoiceSessionPanel';

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
        <p style={{ lineHeight: 1.6 }}>
          Voice-first collaboration environment for designing AWS architectures. The upcoming
          milestones include realtime WebRTC conversations with OpenAI, a shared canvas for diagrams,
          and automated deployment execution driven by AgentCore and Claude.
        </p>
      </header>

      <section style={{ display: 'grid', gap: '1.5rem' }}>
        <VoiceSessionPanel />

        <article style={{ padding: '1.5rem', borderRadius: '1rem', background: '#0f172a' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Upcoming Integrations</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
            <li>WebRTC media capture pipeline and OpenAI Realtime signaling bridge</li>
            <li>AgentCore Gateway service for tool orchestration and memory</li>
            <li>Embedded canvas for Excalidraw and Mermaid-driven diagrams</li>
            <li>Secure deployment automation path with Anthropic Claude container</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
