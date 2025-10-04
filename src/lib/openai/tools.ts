import { AWS_KNOWLEDGE_TOOLS, TAVILY_TOOLS, VOICE_AGENT_TOOLS } from '@/lib/openai/prompt';

const EXCALIDRAW_MCP_TOOL = {
  type: 'function',
  name: 'canvas_request_excalidraw_operations',
  description: 'Requests the Excalidraw MCP server to create or update elements and returns normalized operations.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create_elements', 'update_element', 'delete_element', 'clear_scene'],
      },
      payload: {
        type: 'object',
        description: 'Operation-specific payload forwarded to the MCP server.',
        additionalProperties: true,
      },
    },
    required: ['operation', 'payload'],
    additionalProperties: false,
  },
} as const;

type ToolDefinition =
  | (typeof VOICE_AGENT_TOOLS)[number]
  | (typeof AWS_KNOWLEDGE_TOOLS)[number]
  | (typeof TAVILY_TOOLS)[number]
  | typeof EXCALIDRAW_MCP_TOOL;

export function getVoiceAgentTools(features: {
  includeExcalidrawMcp: boolean;
  includeAwsKnowledge: boolean;
  includeTavily: boolean;
}): ToolDefinition[] {
  const tools: ToolDefinition[] = [...VOICE_AGENT_TOOLS];

  if (features.includeAwsKnowledge) {
    tools.push(...AWS_KNOWLEDGE_TOOLS);
  }

  if (features.includeTavily) {
    tools.push(...TAVILY_TOOLS);
  }

  if (features.includeExcalidrawMcp) {
    tools.push(EXCALIDRAW_MCP_TOOL);
  }

  return tools;
}
