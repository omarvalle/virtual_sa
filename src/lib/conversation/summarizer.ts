import { getEnv, getOptionalEnv } from '@/lib/config/env';
import type { TranscriptTurn } from '@/lib/conversation/types';

const DEFAULT_SUMMARY_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

type SummarySchema = {
  summary: string;
  highlights: string[];
  todos: string[];
};

function buildTranscriptPrompt(turns: TranscriptTurn[]): string {
  return turns
    .map((turn) => `${turn.speaker === 'assistant' ? 'Assistant' : 'User'}: ${turn.text}`)
    .join('\n');
}

export async function generateConversationSummary(turns: TranscriptTurn[]): Promise<SummarySchema> {
  if (turns.length === 0) {
    return { summary: '', highlights: [], todos: [] };
  }

  const apiKey = getEnv('OPENAI_API_KEY');
  const model = getOptionalEnv('OPENAI_SUMMARY_MODEL', DEFAULT_SUMMARY_MODEL);

  const prompt = buildTranscriptPrompt(turns);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'conversation_summary',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: {
                type: 'string',
                description: 'A concise paragraph summarising the conversation so far.',
              },
              highlights: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Key bullet points or decisions the team agreed upon.',
              },
              todos: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Actionable next steps assigned or implied during the conversation.',
              },
            },
            required: ['summary', 'highlights', 'todos'],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a note-taking assistant. Extract the key takeaways and action items from the conversation.' +
            ' Respond strictly in JSON matching the provided schema.',
        },
        {
          role: 'user',
          content: `Conversation transcript:\n${prompt}`,
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to generate conversation summary: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  const body = (await response.json()) as {
    choices?: Array<{
      message: {
        content?: string;
      };
    }>;
  };

  const outputText = body.choices?.[0]?.message?.content;
  if (!outputText) {
    throw new Error('Summary response missing content.');
  }

  let parsed: SummarySchema;
  try {
    parsed = JSON.parse(outputText) as SummarySchema;
  } catch (error) {
    throw new Error('Unable to parse summary JSON.');
  }

  return parsed;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = getEnv('OPENAI_API_KEY');
  const model = getOptionalEnv('OPENAI_EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create embedding: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  const body = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
  };

  const embedding = body.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding response missing data.');
  }

  return embedding;
}
