# Excalidraw MCP Integration Plan

This project now ships with an in-process Excalidraw MCP implementation. Voice tools can request structured operations (`canvas_request_excalidraw_operations`) without any external HTTP bridge, and the backend translates them straight into canvas updates. Use the guidance below if you want to run the standalone MCP server instead (for parity testing or remote orchestration).

## 1. Default (co-located) setup
- No extra services are required—`EXCALIDRAW_MCP_MODE` defaults to `local`.
- When `EXCALIDRAW_MCP_ENABLED` is unset, the voice agent automatically exposes the Excalidraw MCP tool.
- `callExcalidrawMcp` validates element payloads, normalises coordinates, and converts them into the same `excalidraw.patch` operations the canvas API understands.
- Shapes support rectangles, diamonds, ellipses, arrows, lines, freehand strokes, text, and labels (labels render as styled text). Font size/family, colour, opacity, and points arrays are all respected.

## 2. (Optional) Launch the standalone Excalidraw MCP server
```bash
# In a separate directory
git clone https://github.com/yctimlin/mcp_excalidraw.git
cd mcp_excalidraw
npm install
npm run build

# Point the MCP canvas sync to this Next.js app
export EXPRESS_SERVER_URL="http://localhost:3000"
export ENABLE_CANVAS_SYNC="true"
# Optional: specify MCP transport
export MCP_TRANSPORT_MODE="stdio"

# Start the canvas + MCP servers
npm run canvas      # serves the Excalidraw UI via Express
npm start           # launches the MCP server
```

> The MCP server issues REST calls to `/api/elements` on this app. That API persists shapes in the same in-memory store used by the canvas preview.

## 3. Configure runtime options
`EXCALIDRAW_MCP_MODE=local` (default) keeps everything in-process. Set `EXCALIDRAW_MCP_MODE=remote` only when you want to hit an external MCP bridge, then provide:
```
EXCALIDRAW_MCP_SESSION_ID=primary-session
EXCALIDRAW_MCP_URL=http://localhost:3333
EXCALIDRAW_MCP_ENABLED=true   # only required when forcing remote mode
```
Restart `npm run dev` after flipping remote mode so the prompt/tool list refreshes.

## 4. Agent tooling
With co-located MCP:
- The voice agent keeps `canvas_patch_excalidraw` as a fallback, but prefers `canvas_request_excalidraw_operations` for structured edits.
- Local mode understands `create_elements`, `update_element`, `delete_element`, and `clear_scene`, mirroring the remote server contract.
- Operations are normalised before being posted to `/api/canvas/events`, so the preview and embedded Excalidraw stay in sync.

## 5. Testing workflow
1. Start `npm run dev` (Next.js app)
2. (Optional) start the standalone MCP server if you want to compare behaviours
3. Open `http://localhost:3000` to launch the voice interface
4. Ask the voice agent to draw shapes or update existing elements; the Canvas Preview reflects changes immediately
5. Use the Excalidraw preview controls to drag or resize shapes and confirm the persisted updates survive a refresh

## 6. Troubleshooting
- **Unsupported element type** – The local handler now recognises rectangles, ellipses, diamonds, arrows, lines, freehand strokes, text, labels, and images. Double-check the tool arguments if you see this message.
- **Remote server 502** – Switch `EXCALIDRAW_MCP_MODE` back to `local` (or remove `EXCALIDRAW_MCP_ENABLED`) when the remote bridge is offline.
- **Fonts look off** – Supply `fontSize` and `fontFamily` in the MCP payload. The preview uses those values when present.

## 7. Next steps
- Register the MCP server as a formal tool in AgentCore (Gateway integration) once we move off local stdio transport.
- Add auto-refresh/websocket updates so the preview reacts instantly without manual refresh.
- Extend the prompt/tool schema so the agent prefers the MCP tool for complex diagrams while keeping the fallback logic as safety net.
