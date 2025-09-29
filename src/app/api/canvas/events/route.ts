import { NextResponse } from 'next/server';
import { readCanvasCommands, recordCanvasCommands, resetCanvasCommands } from '@/lib/canvas/server';
import { applyExcalidrawOperations } from '@/lib/canvas/excalidrawState';
import type {
  CanvasCommandBatch,
  ExcalidrawOperation,
  ExcalidrawElementPayload,
} from '@/lib/canvas/types';

function parseSessionId(url: string): string {
  const { searchParams } = new URL(url);
  return searchParams.get('sessionId') ?? 'primary-session';
}

export async function GET(request: Request) {
  const sessionId = parseSessionId(request.url);
  const commands = readCanvasCommands(sessionId);
  return NextResponse.json({ sessionId, commands });
}

export async function DELETE(request: Request) {
  const sessionId = parseSessionId(request.url);
  resetCanvasCommands(sessionId);
  return NextResponse.json({ sessionId, cleared: true });
}

export async function POST(request: Request) {
  let payload: CanvasCommandBatch;

  try {
    payload = (await request.json()) as CanvasCommandBatch;
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Invalid JSON payload',
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }

  if (!payload?.sessionId || !Array.isArray(payload.commands)) {
    return NextResponse.json(
      { message: 'Request must include sessionId and an array of commands.' },
      { status: 400 },
    );
  }

  recordCanvasCommands(payload);

  const errors: string[] = [];

  payload.commands.forEach((command, index) => {
    if (command.type !== 'excalidraw.patch') {
      return;
    }

    const operationsValue = (command.payload as { operations?: unknown }).operations;
    if (!Array.isArray(operationsValue)) {
      errors.push(`Command ${index} missing 'operations' array for excalidraw.patch.`);
      return;
    }

    const operations: ExcalidrawOperation[] = [];

    operationsValue.forEach((operationRaw, opIndex) => {
      if (!operationRaw || typeof operationRaw !== 'object') {
        errors.push(`Command ${index} operation ${opIndex} is not an object.`);
        return;
      }

      const operation = operationRaw as Record<string, unknown>;
      const kind = operation.kind;

      switch (kind) {
        case 'add_elements': {
          const elements = operation.elements;
          if (!Array.isArray(elements) || elements.length === 0) {
            errors.push(`Command ${index} operation ${opIndex} requires non-empty elements array.`);
            return;
          }
          const sanitizedElements: ExcalidrawElementPayload[] = [];
          elements.forEach((elementRaw, elementIndex) => {
            if (!elementRaw || typeof elementRaw !== 'object') {
              errors.push(`Command ${index} operation ${opIndex} element ${elementIndex} must be an object.`);
              return;
            }
            const element = elementRaw as Record<string, unknown>;
            const type = element.type;
            if (type !== 'rectangle' && type !== 'ellipse' && type !== 'diamond' && type !== 'arrow' && type !== 'text') {
              errors.push(
                `Command ${index} operation ${opIndex} element ${elementIndex} has unsupported type '${String(type)}'.`,
              );
              return;
            }
            const x = Number(element.x);
            const y = Number(element.y);
            if (Number.isNaN(x) || Number.isNaN(y)) {
              errors.push(
                `Command ${index} operation ${opIndex} element ${elementIndex} requires numeric x and y coordinates.`,
              );
              return;
            }
            const sanitized: ExcalidrawElementPayload = {
              id: typeof element.id === 'string' ? element.id : undefined,
              type,
              x,
              y,
              width: typeof element.width === 'number' ? element.width : undefined,
              height: typeof element.height === 'number' ? element.height : undefined,
              text: typeof element.text === 'string' ? element.text : undefined,
              rotation: typeof element.rotation === 'number' ? element.rotation : undefined,
              strokeColor: typeof element.strokeColor === 'string' ? element.strokeColor : undefined,
              backgroundColor: typeof element.backgroundColor === 'string' ? element.backgroundColor : undefined,
              strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : undefined,
              roughness: typeof element.roughness === 'number' ? element.roughness : undefined,
              roundness: typeof element.roundness === 'number' ? element.roundness : undefined,
              arrowhead:
                element.arrowhead === 'arrow' || element.arrowhead === 'bar' || element.arrowhead === 'circle'
                  ? element.arrowhead
                  : null,
            };
            sanitizedElements.push(sanitized);
          });

          if (sanitizedElements.length === 0) {
            return;
          }
          operations.push({
            kind: 'add_elements',
            elements: sanitizedElements,
          });
          break;
        }
        case 'update_element': {
          const id = operation.id;
          const props = operation.props;
          if (typeof id !== 'string' || !props || typeof props !== 'object') {
            errors.push(`Command ${index} operation ${opIndex} requires string id and object props.`);
            return;
          }
          operations.push({
            kind: 'update_element',
            id,
            props: props as Record<string, unknown>,
          });
          break;
        }
        case 'remove_element': {
          const id = operation.id;
          if (typeof id !== 'string') {
            errors.push(`Command ${index} operation ${opIndex} requires string id.`);
            return;
          }
          operations.push({ kind: 'remove_element', id });
          break;
        }
        case 'clear_scene':
          operations.push({ kind: 'clear_scene' });
          break;
        default:
          errors.push(`Command ${index} operation ${opIndex} has unsupported kind '${String(kind)}'.`);
      }
    });

    if (operations.length > 0) {
      applyExcalidrawOperations(payload.sessionId, operations);
    }
  });

  if (errors.length > 0) {
    return NextResponse.json(
      {
        message: 'One or more excalidraw.patch operations were invalid.',
        errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    sessionId: payload.sessionId,
    accepted: payload.commands.length,
  });
}
