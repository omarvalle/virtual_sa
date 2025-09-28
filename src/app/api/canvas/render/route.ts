import { NextResponse } from 'next/server';
import { readCanvasCommands } from '@/lib/canvas/server';
import type { CanvasCommand } from '@/lib/canvas/types';
import { renderMermaidDiagram } from '@/lib/canvas/mermaidRenderer';

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
    return NextResponse.json({ sessionId, svg: null, diagram: null });
  }

  const diagram = typeof mermaidCommand.payload?.diagram === 'string' ? mermaidCommand.payload.diagram : null;
  const title = typeof mermaidCommand.payload?.title === 'string' ? mermaidCommand.payload.title : null;
  const focus = typeof mermaidCommand.payload?.focus === 'string' ? mermaidCommand.payload.focus : null;

  if (!diagram) {
    return NextResponse.json({
      sessionId,
      svg: null,
      commandId: mermaidCommand.id,
      diagram: null,
      title,
      focus,
      error: 'Mermaid command missing diagram content.',
    });
  }

  try {
    const svg = await renderMermaidDiagram(diagram);
    return NextResponse.json({
      sessionId,
      svg,
      commandId: mermaidCommand.id,
      diagram,
      title,
      focus,
    });
  } catch (error) {
    return NextResponse.json({
      sessionId,
      svg: null,
      commandId: mermaidCommand.id,
      diagram,
      title,
      focus,
      error: error instanceof Error ? error.message : 'Failed to render Mermaid diagram.',
    });
  }
}
