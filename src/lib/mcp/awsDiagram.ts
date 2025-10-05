import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createInterface } from 'node:readline';

import {
  getAwsDiagramMcpMode,
  getAwsDiagramMcpUrl,
  getMcpServiceApiKey,
} from '@/lib/config/env';

export type AwsDiagramToolName =
  | 'aws_generate_diagram'
  | 'aws_list_diagram_icons'
  | 'aws_get_diagram_examples';

const TOOL_NAME_TRANSLATIONS: Record<AwsDiagramToolName, string> = {
  aws_generate_diagram: 'generate_diagram',
  aws_list_diagram_icons: 'list_icons',
  aws_get_diagram_examples: 'get_diagram_examples',
};

type JsonRpcSuccess<T = unknown> = {
  jsonrpc: '2.0';
  id?: string;
  result: T;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id?: string;
  error: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

type DiagramCallOptions = {
  signal?: AbortSignal;
};

type PendingEntry = {
  resolve: (value: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

function sanitizeArguments(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object') {
    return { ...(args as Record<string, unknown>) };
  }
  return {};
}

function assertToolName(tool: string): asserts tool is AwsDiagramToolName {
  if (!Object.prototype.hasOwnProperty.call(TOOL_NAME_TRANSLATIONS, tool)) {
    throw new Error(`Unsupported AWS diagram tool: ${tool}`);
  }
}

function buildRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function callAwsDiagramRemote(
  tool: AwsDiagramToolName,
  args: Record<string, unknown>,
  options: DiagramCallOptions,
): Promise<JsonRpcResponse> {
  const baseUrl = getAwsDiagramMcpUrl();
  const targetUrl = new URL('/tools/call', baseUrl);
  const apiKey = getMcpServiceApiKey();

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({
      name: TOOL_NAME_TRANSLATIONS[tool],
      arguments: args,
    }),
    signal: options.signal,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `AWS Diagram MCP request failed: ${response.status} ${response.statusText} ${text}`.trim(),
    );
  }

  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch (error) {
    throw new Error('AWS Diagram MCP response was not valid JSON.');
  }
}

async function callAwsDiagramLocal(
  tool: AwsDiagramToolName,
  args: Record<string, unknown>,
  options: DiagramCallOptions,
): Promise<JsonRpcResponse> {
  const child = spawn('uvx', ['awslabs.aws-diagram-mcp-server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_DISABLE_COLORS: '1',
      NO_COLOR: '1',
      UV_FORCE_COLOR: '0',
    },
  });

  const pending = new Map<string, PendingEntry>();
  let finished = false;
  let capturedError: Error | null = null;

  const cleanup = async () => {
    if (finished) {
      return;
    }
    finished = true;
    pending.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(capturedError ?? new Error('AWS Diagram MCP process terminated unexpectedly.'));
    });
    pending.clear();
    try {
      readline.close();
    } catch (error) {
      // ignore
    }
    try {
      child.stdin?.end();
    } catch (error) {
      // ignore
    }
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      delay(1000),
    ]);
  };

  const readline = createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });

  readline.on('line', (line) => {
    if (!line || line.trim().length === 0) {
      return;
    }
    let parsed: JsonRpcResponse | null = null;
    try {
      parsed = JSON.parse(line) as JsonRpcResponse;
    } catch (error) {
      console.warn('[aws-diagram-local] unable to parse line', line);
      return;
    }

    const responseId = parsed?.id;
    if (responseId && pending.has(responseId)) {
      const pendingEntry = pending.get(responseId);
      if (pendingEntry) {
        clearTimeout(pendingEntry.timer);
        pendingEntry.resolve(parsed);
        pending.delete(responseId);
      }
    }
  });

  const rejectAll = (error: Error) => {
    if (finished) {
      return;
    }
    capturedError = error;
    pending.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(error);
    });
    pending.clear();
  };

  child.once('error', (error) => {
    rejectAll(error instanceof Error ? error : new Error(String(error)));
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    if (text && text.trim().length > 0) {
      console.warn('[aws-diagram-local] stderr:', text.trim());
    }
  });

  const sendRequest = (method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> => {
    const id = buildRequestId();
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      try {
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`AWS Diagram MCP request timed out: ${method}`));
          }
        }, 30000);

        pending.set(id, {
          resolve,
          reject,
          timer,
        });

        child.stdin?.write(`${JSON.stringify(message)}\n`);
      } catch (error) {
        pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  if (options.signal) {
    const abortHandler = () => {
      const abortError = new Error('AWS Diagram MCP request aborted.');
      rejectAll(abortError);
      void cleanup();
    };
    if (options.signal.aborted) {
      abortHandler();
    } else {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  try {
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'virtual-sa-local-wrapper',
        version: '1.0.0',
      },
    });

    if ('error' in initResponse) {
      throw new Error(initResponse.error?.message ?? 'Failed to initialize AWS Diagram MCP.');
    }

    // Send notification to complete handshake (non-blocking, no id expected)
    child.stdin?.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      })}\n`,
    );

    const callResponse = await sendRequest('tools/call', {
      name: TOOL_NAME_TRANSLATIONS[tool],
      arguments: args,
    });

    return callResponse;
  } finally {
    await cleanup();
  }
}

export async function callAwsDiagramMcp(
  tool: AwsDiagramToolName,
  args: Record<string, unknown>,
  options: DiagramCallOptions = {},
): Promise<JsonRpcResponse> {
  assertToolName(tool);
  const sanitizedArgs = sanitizeArguments(args);
  const mode = getAwsDiagramMcpMode();

  if (mode === 'remote') {
    return callAwsDiagramRemote(tool, sanitizedArgs, options);
  }
  return callAwsDiagramLocal(tool, sanitizedArgs, options);
}
