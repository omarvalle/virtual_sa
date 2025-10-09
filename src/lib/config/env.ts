const requiredEnvVars = [
  'OPENAI_API_KEY',
  'OPENAI_REALTIME_MODEL',
  'OPENAI_REALTIME_API_URL',
] as const;

function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

export function assertRequiredEnv() {
  const missing: string[] = [];

  requiredEnvVars.forEach((key) => {
    const value = readEnv(key);
    if (!value) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function getEnv(name: string, fallback?: string): string {
  const value = readEnv(name);
  if (value === undefined || value === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback?: string): string | undefined {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }
  return value;
}

export function getCsvEnv(name: string): string[] {
  const value = readEnv(name);
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
export function isExcalidrawMcpEnabled(): boolean {
  const explicit = readEnv('EXCALIDRAW_MCP_ENABLED');
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return explicit.toLowerCase() === 'true';
  }
  return getExcalidrawMcpMode() === 'local';
}

export function getExcalidrawMcpUrl(): string {
  return getOptionalEnv('EXCALIDRAW_MCP_URL') ?? 'http://127.0.0.1:3100';
}

export function getExcalidrawMcpSessionId(): string {
  return getOptionalEnv('EXCALIDRAW_MCP_SESSION_ID') ?? 'primary-session';
}

export function getExcalidrawMcpMode(): 'local' | 'remote' {
  const value = (readEnv('EXCALIDRAW_MCP_MODE') ?? 'local').toLowerCase();
  return value === 'remote' ? 'remote' : 'local';
}

export function isAwsKnowledgeMcpEnabled(): boolean {
  return (readEnv('AWS_KNOWLEDGE_MCP_ENABLED') ?? 'false').toLowerCase() === 'true';
}

export function getAwsKnowledgeMcpUrl(): string {
  return getOptionalEnv('AWS_KNOWLEDGE_MCP_URL') ?? 'https://knowledge-mcp.global.api.aws';
}

export function isTavilyApiEnabled(): boolean {
  return Boolean(getOptionalEnv('TAVILY_API_KEY'));
}

export function getTavilyApiKey(): string {
  return getEnv('TAVILY_API_KEY');
}

export function getTavilyApiBaseUrl(): string {
  return getOptionalEnv('TAVILY_API_BASE_URL') ?? 'https://api.tavily.com';
}

export function isPerplexityApiEnabled(): boolean {
  return Boolean(getOptionalEnv('PERPLEXITY_API_KEY'));
}

export function getPerplexityApiKey(): string {
  return getEnv('PERPLEXITY_API_KEY');
}

export function getPerplexityApiBaseUrl(): string {
  return getOptionalEnv('PERPLEXITY_API_BASE_URL') ?? 'https://api.perplexity.ai';
}

export function isAwsDiagramMcpEnabled(): boolean {
  const explicit = readEnv('AWS_DIAGRAM_MCP_ENABLED');
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return explicit.toLowerCase() === 'true';
  }
  if (getAwsDiagramMcpMode() === 'local') {
    return true;
  }
  return Boolean(getOptionalEnv('AWS_DIAGRAM_MCP_URL'));
}

export function getAwsDiagramMcpUrl(): string {
  const url = getOptionalEnv('AWS_DIAGRAM_MCP_URL');
  if (!url) {
    throw new Error('AWS_DIAGRAM_MCP_URL is not configured.');
  }
  return url;
}

export function getAwsDiagramMcpMode(): 'local' | 'remote' {
  const value = (readEnv('AWS_DIAGRAM_MCP_MODE') ?? 'local').toLowerCase();
  return value === 'remote' ? 'remote' : 'local';
}

export function getMcpServiceApiKey(): string | undefined {
  return getOptionalEnv('MCP_SERVICE_API_KEY') ?? getOptionalEnv('CANVAS_API_KEY');
}
