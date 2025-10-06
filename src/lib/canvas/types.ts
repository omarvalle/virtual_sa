export type CanvasCommandType =
  | 'mermaid.update'
  | 'excalidraw.initialize'
  | 'excalidraw.patch'
  | 'excalidraw.sync'
  | 'aws.diagram.update'
  | 'note.append'
  | 'metadata.set';

export type CanvasCommand = {
  id: string;
  sessionId: string;
  type: CanvasCommandType;
  payload: Record<string, unknown>;
  issuedAt: number;
  issuedBy: 'agent' | 'user' | 'system';
};

export type CanvasCommandBatch = {
  sessionId: string;
  commands: CanvasCommand[];
};

export type ExcalidrawPoint = [number, number];

export type ExcalidrawElementPayload = {
  id?: string;
  type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'text' | 'label' | 'freedraw' | 'line' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  rotation?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  roughness?: number;
  roundness?: number;
  arrowhead?: 'arrow' | 'bar' | 'circle' | null;
  points?: ExcalidrawPoint[];
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch' | 'zigzag' | 'dots';
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  src?: string;
  fileId?: string;
  status?: 'pending' | 'saved';
};

export type ExcalidrawOperation =
  | {
      kind: 'add_elements';
      elements: ExcalidrawElementPayload[];
    }
  | {
      kind: 'update_element';
      id: string;
      props: Partial<ExcalidrawElementPayload>;
    }
  | {
      kind: 'remove_element';
      id: string;
    }
  | {
      kind: 'clear_scene';
    };
