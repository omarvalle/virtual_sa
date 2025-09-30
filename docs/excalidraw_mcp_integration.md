# Excalidraw MCP Integration Plan

This project now exposes REST endpoints compatible with the **mcp_excalidraw** canvas sync API. Follow these steps to connect the dedicated MCP server so voice-tool output renders precisely on our canvas.

## 1. Prerequisites
- Node.js 18+
- `git` and `npm`
- This Next.js app running locally on `http://localhost:3000`

## 2. Launch the Excalidraw MCP server
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

> The MCP server will send `POST/PUT/DELETE` requests to `/api/elements` on port 3000. Those routes now persist shapes in the same in-memory store used by the canvas preview.

## 3. Update environment (optional)
Copy `.env.example` to `.env.local` and set:
```
EXCALIDRAW_MCP_ENABLED=true
EXCALIDRAW_MCP_SESSION_ID=primary-session
EXCALIDRAW_MCP_URL=http://localhost:3333
```
No restart is needed for the API routes, but do restart `npm run dev` so the prompt/tool updates load.

## 4. Agent tooling
With the MCP server active:
- The voice agent can continue using `canvas_patch_excalidraw`. The backend now accepts MCP-formatted payloads as well as the simplified `draw`/`add` formats.
- MCP-driven creation/update/delete requests will hit the `/api/elements` REST endpoints and feed into our SVG preview automatically.

## 5. Testing workflow
1. Start `npm run dev` (Next.js app)
2. Start the MCP canvas and server as shown above
3. Open `http://localhost:3000` (our app) and `http://localhost:3000/excalidraw` (optional MCP UI if served separately)
4. Ask the voice agent: "Draw a circle" or "Place a square at x=450 y=200"
5. Check the Canvas Preview panel and the MCP UI—both should reflect the updates.

## 6. Troubleshooting
- **No shapes appear** – Confirm the MCP server logs show successful sync to `/api/elements`. Our Next.js console now prints `[canvas]` diagnostics for every command.
- **Port conflict** – If the MCP Express server also runs on port 3000, set `PORT=3100` when launching it and adjust any references to the Excalidraw UI accordingly. `EXPRESS_SERVER_URL` should still target `http://localhost:3000` (this app).
- **CORS errors** – Ensure the MCP server and this app run on the same host or configure CORS headers on the MCP side.

## 7. Next steps
- Register the MCP server as a formal tool in AgentCore (Gateway integration) once we move off local stdio transport.
- Add auto-refresh/websocket updates so the preview reacts instantly without manual refresh.
- Extend the prompt/tool schema so the agent prefers the MCP tool for complex diagrams while keeping the fallback logic as safety net.
