import { VOICE_AGENT_TOOLS } from '@/lib/openai/prompt';

type ToolDefinition = (typeof VOICE_AGENT_TOOLS)[number];

export function getVoiceAgentTools(features: { includeExcalidrawMcp: boolean }): ToolDefinition[] {
  if (!features.includeExcalidrawMcp) {
    return VOICE_AGENT_TOOLS;
  }

  return [
    ...VOICE_AGENT_TOOLS,
    {
      type: 'function',
      name: 'canvas_request_excalidraw_operations',
      description:
        'Requests the Excalidraw MCP server to create or update elements and returns normalized operations.',
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
          },
        },
        required: ['operation'],
        additionalProperties: false,
      },
    },
  ];
}
