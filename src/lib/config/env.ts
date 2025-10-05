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

export function isTavilyMcpEnabled(): boolean {
  const link = getOptionalEnv('TAVILY_MCP_LINK');
  const key = getOptionalEnv('TAVILY_API_KEY');
  return Boolean(link && link.trim().length > 0) || Boolean(key && key.trim().length > 0);
}

export function getTavilyMcpUrl(): string {
  const rawLink = getOptionalEnv('TAVILY_MCP_LINK')?.trim();
  const key = getOptionalEnv('TAVILY_API_KEY')?.trim();

  if (rawLink && rawLink.includes('tavilyApiKey=')) {
    return rawLink;
  }

  const base = rawLink && rawLink.length > 0 ? rawLink : 'https://mcp.tavily.com/mcp/';

  if (!key || key.length === 0) {
    throw new Error('TAVILY_API_KEY must be set when TAVILY_MCP_LINK does not include a tavilyApiKey query parameter.');
  }

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}tavilyApiKey=${encodeURIComponent(key)}`;
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
