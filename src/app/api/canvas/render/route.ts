import { NextResponse } from 'next/server';
import { readCanvasCommands } from '@/lib/canvas/server';
import type { CanvasCommand } from '@/lib/canvas/types';

function collectLatestMermaidCommand(commands: CanvasCommand[]): CanvasCommand | null {
  for (let i = commands.length - 1; i >= 0; i -= 1) {
    if (commands[i].type === 'mermaid.update') {
      return commands[i];
    }
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') ?? 'primary-session';

  const commands = readCanvasCommands(sessionId);
  const mermaidCommand = collectLatestMermaidCommand(commands);

  if (!mermaidCommand) {
    return NextResponse.json({ sessionId, svg: null });
  }

  const svg = `<!-- Mermaid placeholder render -->\n<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">\n  <rect width="600" height="400" fill="#0f172a"/>\n  <text x="300" y="200" text-anchor="middle" fill="#e2e8f0" font-size="16">Mermaid rendering pending</text>\n  <text x="300" y="230" text-anchor="middle" fill="#94a3b8" font-size="12">Commands stored: ${commands.length}</text>\n</svg>`;

  return NextResponse.json({
    sessionId,
    svg,
    commandId: mermaidCommand.id,
    diagram: mermaidCommand.payload?.diagram ?? null,
  });
}
