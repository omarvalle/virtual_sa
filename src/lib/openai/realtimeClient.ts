export type VoiceSessionConfig = {
  sessionName: string;
  clientSecret: string;
  realtimeUrl: string;
};

export type VoiceSessionHandles = {
  config: VoiceSessionConfig;
  localStream: MediaStream;
  peerConnection: RTCPeerConnection;
  controlChannel: RTCDataChannel | null;
};

export type RequestTokenFn = () => Promise<{
  clientSecret: string;
  realtimeUrl: string;
}>;

export type MediaStreamFn = () => Promise<MediaStream>;

export type RealtimeCallbacks = {
  onRemoteTrack?: (event: RTCTrackEvent) => void;
  onControlMessage?: (event: MessageEvent<string>) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
};

async function waitForIceGathering(
  peerConnection: RTCPeerConnection,
  timeoutMs = 3000,
): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') {
    return;
  }

  let resolved = false;

  await new Promise<void>((resolve) => {
    const finish = () => {
      if (resolved) return;
      resolved = true;
      peerConnection.removeEventListener('icegatheringstatechange', onStateChange);
      peerConnection.removeEventListener('icecandidate', onCandidate);
      clearTimeout(timer);
      resolve();
    };

    const onStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        finish();
      }
    };

    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) {
        finish();
      }
    };

    const timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    peerConnection.addEventListener('icegatheringstatechange', onStateChange);
    peerConnection.addEventListener('icecandidate', onCandidate);
  });
}

export async function createRealtimeSession(
  requestToken: RequestTokenFn,
  getMediaStream: MediaStreamFn,
  callbacks: RealtimeCallbacks = {},
): Promise<VoiceSessionHandles> {
  const [credentials, localStream] = await Promise.all([
    requestToken(),
    getMediaStream(),
  ]);

  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });

  if (callbacks.onRemoteTrack) {
    peerConnection.addEventListener('track', callbacks.onRemoteTrack);
  }

  if (callbacks.onConnectionStateChange) {
    peerConnection.addEventListener('connectionstatechange', () => {
      callbacks.onConnectionStateChange?.(peerConnection.connectionState);
    });
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  const controlChannel = peerConnection.createDataChannel('oai-events');

  if (callbacks.onControlMessage) {
    controlChannel.addEventListener('message', (event) => {
      callbacks.onControlMessage?.(event as MessageEvent<string>);
    });
  }

  const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
  await peerConnection.setLocalDescription(offer);

  await waitForIceGathering(peerConnection);

  const localDescription = peerConnection.localDescription;

  if (!localDescription?.sdp) {
    throw new Error('Local description missing after ICE gathering.');
  }

  const sdpResponse = await fetch('/api/voice/sdp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientSecret: credentials.clientSecret,
      realtimeUrl: credentials.realtimeUrl,
      sdp: localDescription.sdp,
    }),
  });

  if (!sdpResponse.ok) {
    const errorBody = await sdpResponse.json().catch(() => ({}));
    throw new Error(errorBody?.message ?? 'Realtime SDP exchange failed.');
  }

  const { answer } = (await sdpResponse.json()) as { answer: string };

  await peerConnection.setRemoteDescription({
    type: 'answer',
    sdp: answer,
  });

  return {
    config: {
      sessionName: 'primary-session',
      clientSecret: credentials.clientSecret,
      realtimeUrl: credentials.realtimeUrl,
    },
    localStream,
    peerConnection,
    controlChannel,
  };
}
