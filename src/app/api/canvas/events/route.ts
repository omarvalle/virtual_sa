import { NextResponse } from 'next/server';
import { readCanvasCommands, recordCanvasCommands, resetCanvasCommands } from '@/lib/canvas/server';
import { applyExcalidrawOperations, getExcalidrawScene } from '@/lib/canvas/excalidrawState';
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

  const warnings: string[] = [];

  console.info('[canvas] Received command batch', JSON.stringify(payload, null, 2));

  const fallbackElements = (summary: string | undefined): ExcalidrawOperation[] => {
    const text = summary?.toLowerCase() ?? '';
    const isCircle = text.includes('circle');
    const isEllipse = text.includes('oval');
    const isDiamond = text.includes('diamond');
    const isArrow = text.includes('arrow');
    const type: ExcalidrawElementPayload['type'] = isCircle || isEllipse ? 'ellipse' : isDiamond ? 'diamond' : isArrow ? 'arrow' : 'rectangle';
    return [
      {
        kind: 'add_elements',
        elements: [
          {
            type,
            x: 200,
            y: 140,
            width: type === 'arrow' ? 160 : 120,
            height: type === 'arrow' ? 40 : 120,
            text: type === 'text' ? 'Note' : undefined,
            strokeColor: '#22d3ee',
            backgroundColor: type === 'arrow' ? undefined : 'rgba(34, 211, 238, 0.2)',
          },
        ],
      },
    ];
  };

  const normalizeAdHocOperation = (
    operation: Record<string, unknown>,
    commandIndex: number,
    opIndex: number,
  ): ExcalidrawOperation | null => {
    const opType = typeof operation.type === 'string' ? operation.type.toLowerCase() : '';
    const shape = typeof operation.shape === 'string' ? operation.shape.toLowerCase() : '';

    if (opType === 'draw') {
      const elementType: ExcalidrawElementPayload['type'] = shape.includes('circle') || shape.includes('ellipse')
        ? 'ellipse'
        : shape.includes('diamond')
          ? 'diamond'
          : shape.includes('arrow')
            ? 'arrow'
            : shape.includes('text')
              ? 'text'
              : 'rectangle';

      const x = Number(operation.x ?? 200);
      const y = Number(operation.y ?? 140);
      const width = Number(operation.width ?? (elementType === 'arrow' ? 160 : 120));
      const height = Number(operation.height ?? (elementType === 'arrow' ? 40 : 120));

      if (Number.isNaN(x) || Number.isNaN(y)) {
        warnings.push(`Command ${commandIndex} operation ${opIndex} ignored: missing numeric coordinates.`);
        return null;
      }

      const element: ExcalidrawElementPayload = {
        type: elementType,
        x,
        y,
        width: Number.isNaN(width) ? undefined : width,
        height: Number.isNaN(height) ? undefined : height,
        strokeColor:
          typeof operation.strokeColor === 'string'
            ? operation.strokeColor
            : typeof operation.color === 'string'
              ? operation.color
              : '#22d3ee',
        backgroundColor:
          typeof operation.fillColor === 'string'
            ? operation.fillColor
            : elementType === 'arrow'
              ? undefined
              : 'rgba(34, 211, 238, 0.2)',
        text: typeof operation.text === 'string' ? operation.text : undefined,
      };

      return {
        kind: 'add_elements',
        elements: [element],
      };
    }

    return null;
  };

  payload.commands.forEach((command, index) => {
    if (command.type !== 'excalidraw.patch') {
      if (command.type === 'mermaid.update') {
        console.info('[canvas] Mermaid update payload', command.payload);
      }
      return;
    }

    const operationsValue = (command.payload as { operations?: unknown }).operations;
    if (!Array.isArray(operationsValue) || operationsValue.length === 0) {
      const summary = typeof (command.payload as Record<string, unknown>).summary === 'string'
        ? (command.payload as Record<string, unknown>).summary
        : undefined;
      const fallback = fallbackElements(summary);
      applyExcalidrawOperations(payload.sessionId, fallback);
      warnings.push(`Command ${index} missing operations; applied fallback ${fallback[0].elements[0].type}.`);
      console.info('[canvas] Applied fallback operations', fallback);
      return;
    }

    const operations: ExcalidrawOperation[] = [];

    operationsValue.forEach((operationRaw, opIndex) => {
      if (!operationRaw || typeof operationRaw !== 'object') {
        warnings.push(`Command ${index} operation ${opIndex} ignored (not an object).`);
        return;
      }

      const operation = operationRaw as Record<string, unknown>;
      const kind = operation.kind;

      switch (kind) {
        case 'add_elements': {
          const elements = operation.elements;
          if (!Array.isArray(elements) || elements.length === 0) {
            warnings.push(`Command ${index} operation ${opIndex} requires non-empty elements array.`);
            return;
          }
          const sanitizedElements: ExcalidrawElementPayload[] = [];
          elements.forEach((elementRaw, elementIndex) => {
            if (!elementRaw || typeof elementRaw !== 'object') {
              warnings.push(`Command ${index} operation ${opIndex} element ${elementIndex} ignored (not an object).`);
              return;
            }
            const element = elementRaw as Record<string, unknown>;
            const type = element.type;
            if (type !== 'rectangle' && type !== 'ellipse' && type !== 'diamond' && type !== 'arrow' && type !== 'text') {
              warnings.push(
                `Command ${index} operation ${opIndex} element ${elementIndex} has unsupported type '${String(type)}'.`,
              );
              return;
            }
            const x = Number(element.x);
            const y = Number(element.y);
            if (Number.isNaN(x) || Number.isNaN(y)) {
              warnings.push(
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
            warnings.push(`Command ${index} operation ${opIndex} requires string id and object props.`);
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
            warnings.push(`Command ${index} operation ${opIndex} requires string id.`);
            return;
          }
          operations.push({ kind: 'remove_element', id });
          break;
        }
        case 'clear_scene':
          operations.push({ kind: 'clear_scene' });
          break;
        case undefined: {
          const interpreted = normalizeAdHocOperation(operation, index, opIndex);
          if (interpreted) {
            operations.push(interpreted);
            console.info('[canvas] Normalized ad-hoc operation', interpreted);
          }
          break;
        }
        default:
          warnings.push(`Command ${index} operation ${opIndex} has unsupported kind '${String(kind)}'.`);
      }
    });

    if (operations.length === 0) {
      const summary = typeof (command.payload as Record<string, unknown>).summary === 'string'
        ? (command.payload as Record<string, unknown>).summary
        : undefined;
      const fallback = fallbackElements(summary);
      console.info('[canvas] No valid operations parsed; applying fallback', fallback);
      applyExcalidrawOperations(payload.sessionId, fallback);
      warnings.push(`Command ${index} had no valid operations; applied fallback ${fallback[0].elements[0].type}.`);
      return;
    }

    console.info('[canvas] Applying operations', operations);
    applyExcalidrawOperations(payload.sessionId, operations);
  });

  console.info('[canvas] Current scene', getExcalidrawScene(payload.sessionId));

  return NextResponse.json({
    sessionId: payload.sessionId,
    accepted: payload.commands.length,
    warnings,
  });
}
