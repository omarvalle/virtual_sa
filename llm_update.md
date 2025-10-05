# LLM Update Notes

Welcome aboard! This log captures the current state of the Virtual Solutions Architect project and the next items in flight. Use it to ramp quickly and avoid duplicating work.

## Quick Status
- Voice agent → OpenAI Realtime pipeline is functioning: WebRTC handshake, audio streaming, transcripts, and function calls all succeed.
- Mermaid diagrams render reliably in the preview when the agent calls `canvas_update_mermaid`.
- Excalidraw MCP runs in-process by default. Structured operations (`create_elements`, `update_element`, `delete_element`, `clear_scene`) are normalised locally and rendered directly on the canvas preview. Labels now render like text blocks with font size/family support.
- AWS Knowledge MCP integration is available behind the `AWS_KNOWLEDGE_MCP_ENABLED` flag. When enabled, the agent can search (`aws_knowledge_search`), read (`aws_knowledge_read`), and recommend (`aws_knowledge_recommend`) official guidance.
- Tavily MCP integration is now wired: if `TAVILY_API_KEY` (or `TAVILY_MCP_LINK`) is present, the voice agent can run real-time search (`tavily_search`), extraction (`tavily_extract`), crawls (`tavily_crawl`), and site maps (`tavily_map`). Responses are trimmed (max 3 links + optional summary), defaults enforce light payloads, and the results are injected into the Realtime context (tool result when a `call_id` is present, otherwise as a system memo) so the assistant can quote the URLs it just fetched.
- AWS Diagram MCP now runs co-located by default. The API route spawns `uvx awslabs.aws-diagram-mcp-server` and converts the result into a base64 PNG for the canvas. Switch to a remote HTTP bridge by setting `AWS_DIAGRAM_MCP_MODE=remote` plus `AWS_DIAGRAM_MCP_URL` if needed.
- Remote Excalidraw MCP wrappers remain optional—set `EXCALIDRAW_MCP_MODE=remote` if you need to hit an external server. Otherwise, no HTTP bridge is required.
- Canvas preview now supports dragging shapes with the pointer, including arrow endpoints for quick resizing. User drags emit `update_element` operations so the shared scene stays in sync.
- Excalidraw MCP calls default to an in-process implementation; remote HTTP mode is still available by setting `EXCALIDRAW_MCP_MODE=remote`.

## Priority Files to Review
- `README.md` – stack overview and setup expectations.
- `docs/agent_tools.md` – authoritative reference for tool schemas exposed to the agent.
- `docs/voice_prompt_instructions.md` – conversational guidelines embedded in the realtime prompt.
- `src/lib/openai/prompt.ts` – live prompt text + tool definitions shipped to OpenAI.
- `src/lib/openai/events.ts` – parses realtime control messages and surfaces function calls.
- `src/components/voice/VoiceSessionPanel.tsx` – browser UI: starts sessions, handles control channel output, posts canvas commands, logs debug events.
- `src/app/api/canvas/events/route.ts` – REST endpoint that records commands and normalizes Excalidraw payloads into operations.
- `src/lib/canvas/{server,excalidrawState,bridge}.ts` – in-memory storage, shape normalization, and function-call translation glue.
- `src/components/canvas/{MermaidPreview,ExcalidrawPreview}.tsx` – render the current diagrams on the page.

## New Capability: AWS Knowledge + Tavily + AWS Diagram MCP Integrations
The hosted `aws-knowledge-mcp-server` runs behind `POST /api/mcp/aws-knowledge`, the Tavily MCP server lives at `POST /api/mcp/tavily`, and the AWS Diagram wrapper is proxied via `POST /api/mcp/aws-diagram`. Function tools are added dynamically based on environment toggles:
- `aws_knowledge_search`, `aws_knowledge_read`, `aws_knowledge_recommend` when `AWS_KNOWLEDGE_MCP_ENABLED=true`.
- `tavily_search`, `tavily_extract`, `tavily_crawl`, `tavily_map` when `TAVILY_API_KEY` or `TAVILY_MCP_LINK` is present.
- `aws_generate_diagram`, `aws_list_diagram_icons`, `aws_get_diagram_examples` when `AWS_DIAGRAM_MCP_URL` is configured.

### Highlights
- Environment toggles and defaults live in `src/lib/config/env.ts`.
- The proxy clients (`src/lib/mcp/awsKnowledge.ts`, `src/lib/mcp/tavily.ts`) perform JSON-RPC/SSE calls and normalize responses for the UI.
- `VoiceSessionPanel` surfaces request/result/error events for all external workflows and renders diagram PNGs inline when returned from the AWS Diagram wrapper.
- Prompt docs (`docs/voice_prompt_instructions.md`, `docs/agent_tools.md`) and runtime instructions have been updated to teach the agent when to call each tool.
- The AWS diagram bridge lives at `src/app/api/mcp/aws-diagram/route.ts` and reuses the shared `X-API-Key` header, allowing hosted MCP servers to plug in without changing the voice UI.

### Follow-up Ideas
1. Feed high-signal answers back into the conversation automatically (e.g., append a note or summarize the top result before asking the user to continue).
2. Add guards for rate limiting and better error differentiation (e.g., 429 vs malformed input) for both MCP proxies.
3. Capture tool outputs in session state so future turns can reference earlier research without re-querying.

## Canvas Follow-ups (still open)
- Monitor future tool calls for unexpected element types; the local mapper now accepts rectangles, ellipses, diamonds, arrows, lines, freehand strokes, text, labels, and images.
- Consider lightweight unit tests around `normalizeAdHocOperation` and the new AWS diagram mapper to guard against regressions once additional MCP features enter the mix.

## Handy Debug Tips
- Watch the DevTools console for `[canvas]` logs from `/api/canvas/events` to see how operations are interpreted.
- The event log UI in `VoiceSessionPanel` shows `canvas.warning` entries whenever normalization falls back—helpful for spotting malformed payloads.
- `GET /api/canvas/excalidraw?sessionId=primary-session` returns the current scene JSON; use it to confirm shapes are being stored as expected.

Keep this document updated as you land features or uncover blockers. Thanks!
