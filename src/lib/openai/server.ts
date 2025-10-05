import {
  getEnv,
  getOptionalEnv,
  isAwsKnowledgeMcpEnabled,
  isExcalidrawMcpEnabled,
  isTavilyMcpEnabled,
} from '@/lib/config/env';
import { getVoiceAgentTools } from '@/lib/openai/tools';
import { VOICE_AGENT_INSTRUCTIONS, VOICE_AGENT_TOOLS } from '@/lib/openai/prompt';

type RealtimeToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type RealtimeSessionRequest = {
  model: string;
  voice?: string;
  instructions?: string;
  tools?: RealtimeToolDefinition[];
  tool_choice?: 'auto' | 'none';
  input_audio_transcription?: {
    model: string;
  };
};

type RealtimeSessionResponse = {
  id?: string;
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
  url?: string;
};

type CreateRealtimeOptions = {
  additionalInstructions?: string;
};

export async function createOpenAIRealtimeSession(options: CreateRealtimeOptions = {}): Promise<{
  clientSecret: string;
  realtimeUrl: string;
  sessionId?: string;
}> {
  const apiKey = getEnv('OPENAI_API_KEY');
  const model = getEnv('OPENAI_REALTIME_MODEL');
  const voice = getOptionalEnv('OPENAI_REALTIME_VOICE');
  const realtimeBaseUrl = getEnv('OPENAI_REALTIME_API_URL');

  const mergedInstructions = options.additionalInstructions
    ? `${VOICE_AGENT_INSTRUCTIONS}\n\nSession context:\n${options.additionalInstructions}`
    : VOICE_AGENT_INSTRUCTIONS;

  const payload: RealtimeSessionRequest = {
    model,
    instructions: mergedInstructions,
    tools: VOICE_AGENT_TOOLS.map((tool) => ({ ...tool })) as RealtimeToolDefinition[],
    tool_choice: 'auto',
    input_audio_transcription: {
      model: getOptionalEnv('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1'),
    },
  };

  if (voice) {
    payload.voice = voice;
  }

  const response = await fetch(`${realtimeBaseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify({
      ...payload,
      tools: getVoiceAgentTools({
        includeExcalidrawMcp: isExcalidrawMcpEnabled(),
        includeAwsKnowledge: isAwsKnowledgeMcpEnabled(),
        includeTavily: isTavilyMcpEnabled(),
      }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create OpenAI realtime session: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  const body = (await response.json()) as RealtimeSessionResponse;

  const clientSecret = body?.client_secret?.value;

  if (!clientSecret) {
    throw new Error('Realtime session response missing client secret.');
  }

  const explicitUrl = body?.url;

  let realtimeUrl: string;

  if (explicitUrl) {
    realtimeUrl = explicitUrl;
  } else {
    const url = new URL(realtimeBaseUrl);
    url.searchParams.set('model', model);
    if (voice) {
      url.searchParams.set('voice', voice);
    }
    realtimeUrl = url.toString();
  }

  return {
    clientSecret,
    realtimeUrl,
    sessionId: body?.id,
  };
}
