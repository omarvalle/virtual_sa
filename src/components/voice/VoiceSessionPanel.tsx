'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { VoiceSessionHandles } from '@/lib/openai/realtimeClient';
import { createRealtimeSession } from '@/lib/openai/realtimeClient';

const panelStyles: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: '1rem',
  background: '#1e293b',
};

export function VoiceSessionPanel() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionHandles, setSessionHandles] = useState<VoiceSessionHandles | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Negotiating secure connection…';
      case 'active':
        return 'Live session active';
      case 'error':
        return 'Unable to connect';
      default:
        return 'Session idle';
    }
  }, [status]);

  const handleRemoteTrack = useCallback((event: RTCTrackEvent) => {
    const [remoteStream] = event.streams;
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, []);

  const handleControlMessage = useCallback((event: MessageEvent<string>) => {
    console.info('Realtime control message', event.data);
  }, []);

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    console.info('WebRTC connection state changed:', state);
  }, []);

  const toggleSession = useCallback(async () => {
    if (status === 'active') {
      sessionHandles?.localStream.getTracks().forEach((track) => track.stop());
      sessionHandles?.peerConnection.close();
      setSessionHandles(null);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      setStatus('idle');
      setError(null);
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const session = await createRealtimeSession(
        async () => {
          const response = await fetch('/api/voice/token', {
            method: 'POST',
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.message ?? 'Failed to obtain realtime credentials');
          }

          return (await response.json()) as {
            clientSecret: string;
            realtimeUrl: string;
          };
        },
        async () => navigator.mediaDevices.getUserMedia({ audio: true }),
        {
          onRemoteTrack: handleRemoteTrack,
          onControlMessage: handleControlMessage,
          onConnectionStateChange: handleConnectionStateChange,
        },
      );

      setSessionHandles(session);
      setStatus('active');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [
    handleConnectionStateChange,
    handleControlMessage,
    handleRemoteTrack,
    sessionHandles,
    status,
  ]);

  return (
    <article style={panelStyles}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Voice Session Status</h2>
      <p style={{ marginBottom: '0.5rem' }}>{statusLabel}</p>

      {error ? (
        <p style={{ color: '#f97316', marginBottom: '1rem' }}>{error}</p>
      ) : (
        <p style={{ marginBottom: '1rem' }}>
          WebRTC capture and OpenAI session negotiation are in progress. Once the backend token service
          is fully authorized, this panel will stream live audio and agent actions.
        </p>
      )}

      <button
        type="button"
        onClick={toggleSession}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '999px',
          border: 'none',
          cursor: status === 'connecting' ? 'progress' : 'pointer',
          background:
            status === 'active' ? '#f97316' : status === 'error' ? '#ef4444' : '#0ea5e9',
          color: '#0f172a',
          fontWeight: 600,
        }}
        disabled={status === 'connecting'}
      >
        {status === 'active' ? 'End Voice Session' : 'Start Voice Session'}
      </button>

      <audio ref={remoteAudioRef} autoPlay playsInline hidden />
    </article>
  );
}
