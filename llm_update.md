# LLM Update Notes

Welcome aboard! This log captures the current state of the Virtual Solutions Architect project and the next items in flight. Use it to ramp quickly and avoid duplicating work.

## Quick Status
- Voice agent → OpenAI Realtime pipeline is functioning: WebRTC handshake, audio streaming, transcripts, and function calls all succeed.
- Mermaid diagrams render reliably in the preview when the agent calls `canvas_update_mermaid`.
- Excalidraw updates partially work: ad-hoc payloads are normalized and we at least render fallback shapes, but rectangles often land with default (ellipse-like) styling/positions. Fallback logic currently infers shapes from the summary when operations are insufficient.
- AWS Knowledge MCP integration is available behind the `AWS_KNOWLEDGE_MCP_ENABLED` flag. When enabled, the agent can search (`aws_knowledge_search`), read (`aws_knowledge_read`), and recommend (`aws_knowledge_recommend`) official guidance.
- Tavily MCP integration is now wired: if `TAVILY_API_KEY` (or `TAVILY_MCP_LINK`) is present, the voice agent can run real-time search (`tavily_search`), extraction (`tavily_extract`), crawls (`tavily_crawl`), and site maps (`tavily_map`).
- Excalidraw MCP server integration is **deferred**. We will eventually host it on AWS; for now the voice agent should continue using `canvas_patch_excalidraw` while we tighten normalization.

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

## New Capability: AWS Knowledge + Tavily MCP Integrations
The hosted `aws-knowledge-mcp-server` runs behind `POST /api/mcp/aws-knowledge` and the Tavily MCP server lives at `POST /api/mcp/tavily`. Function tools are added dynamically based on environment toggles:
- `aws_knowledge_search`, `aws_knowledge_read`, `aws_knowledge_recommend` when `AWS_KNOWLEDGE_MCP_ENABLED=true`.
- `tavily_search`, `tavily_extract`, `tavily_crawl`, `tavily_map` when `TAVILY_API_KEY` or `TAVILY_MCP_LINK` is present.

### Highlights
- Environment toggles and defaults live in `src/lib/config/env.ts`.
- The proxy clients (`src/lib/mcp/awsKnowledge.ts`, `src/lib/mcp/tavily.ts`) perform JSON-RPC/SSE calls and normalize responses for the UI.
- `VoiceSessionPanel` surfaces request/result/error events for both knowledge and Tavily workflows so you can audit calls in real time.
- Prompt docs (`docs/voice_prompt_instructions.md`, `docs/agent_tools.md`) and runtime instructions have been updated to teach the agent when to call each tool.

### Follow-up Ideas
1. Feed high-signal answers back into the conversation automatically (e.g., append a note or summarize the top result before asking the user to continue).
2. Add guards for rate limiting and better error differentiation (e.g., 429 vs malformed input) for both MCP proxies.
3. Capture tool outputs in session state so future turns can reference earlier research without re-querying.

## Canvas Follow-ups (still open)
- Improve normalization so rectangles/squares preserve their intended coordinates and shape rather than defaulting to fallback ellipses.
- Consider lightweight unit tests around `normalizeAdHocOperation` to guard against regressions once AWS MCP features enter the mix.

## Handy Debug Tips
- Watch the DevTools console for `[canvas]` logs from `/api/canvas/events` to see how operations are interpreted.
- The event log UI in `VoiceSessionPanel` shows `canvas.warning` entries whenever normalization falls back—helpful for spotting malformed payloads.
- `GET /api/canvas/excalidraw?sessionId=primary-session` returns the current scene JSON; use it to confirm shapes are being stored as expected.

Keep this document updated as you land features or uncover blockers. Thanks!
