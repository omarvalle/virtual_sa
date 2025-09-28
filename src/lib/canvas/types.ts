export type CanvasCommandType =
  | 'mermaid.update'
  | 'excalidraw.initialize'
  | 'excalidraw.patch'
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
