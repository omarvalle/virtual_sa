# LLM Update Notes

Welcome aboard! This log captures the current state of the Virtual Solutions Architect project and the next items in flight. Use it to ramp quickly and avoid duplicating work.

## Quick Status (2025-10-06)
- Voice agent ↔ OpenAI Realtime: WebRTC, audio streaming, transcripts, and local tool calls (canvas + Excalidraw MCP + AWS Diagram MCP) are solid. User drag updates on the embedded Excalidraw canvas sync back to the server correctly.
- **Search/knowledge issue:** Although Tavily REST calls and AWS Knowledge MCP requests are firing, the assistant keeps telling the user that no results are available. Event logs show successful tool responses (`tavily.result`, etc.), so the bug lives in how we surface those results back into the conversation (likely missing `response.create` follow-up or memo ingestion). This is the top debugging task for the next session.
- Memory layer: SQLite summaries/TODOs are still intermittently missing (`hasSummary: false`). Vector search remains disabled because `sqlite-vec` warns that JSON helpers are unavailable. Investigate once the search issue is resolved.
- Mermaid preview continues to render `canvas_update_mermaid` output. AWS diagrams now arrive as single PNG images that land on the Excalidraw canvas when the diagram MCP succeeds.

## Immediate Next Steps
1. **Debug Tavily / AWS Knowledge follow-up**
   - Inspect `src/lib/openai/events.ts` and `src/components/voice/VoiceSessionPanel.tsx` to ensure tool results trigger a `response.create` (or memo) that the assistant can read.
   - Confirm we are not overwriting tool outputs with `status: "error"` when the canvas sync fires (check `src/app/api/canvas/events/route.ts` and any follow-up logic in the UI).
   - Re-run a voice session: ask for "Top story on Hacker News" and verify that the agent quotes URLs after the tool completes.
2. Verify hosted AWS Knowledge MCP behavior once Tavily is working—same mechanism, so fixes should apply to both.
3. Circle back to the SQLite/vector warnings and the lingering Mermaid lint cleanup once search is reliable.

## Fast Ramp-up Checklist
- Skim `README.md` for environment setup, tool toggles, and the current stack (Next.js + Fast refresh + in-process MCP servers).
- Read `docs/agent_tools.md` and `docs/voice_prompt_instructions.md` to understand which functions the agent can call and the rules baked into the system prompt.
- Review `src/lib/openai/prompt.ts` (tool declarations + voice instructions) and `src/lib/openai/events.ts` (parses realtime messages, dispatches tool handlers).
- Open `src/components/voice/VoiceSessionPanel.tsx`; this is the main UI controller: session lifecycle, logging, popup windows for transcripts/events, and post-processing of tool output.
- For canvas behavior, check `src/lib/canvas/{bridge,excalidrawState,server}.ts` plus the API routes in `src/app/api/canvas/*`.

## Key Files for the Search Bug
- `src/lib/openai/events.ts` – look at `handleToolResult`/`handleToolError` flows.
- `src/components/voice/VoiceSessionPanel.tsx` – `onToolCall` / `onToolResult` wiring and the logic that posts follow-up messages.
- `src/lib/mcp/tavily.ts`, `src/lib/mcp/awsKnowledge.ts` – ensure we normalize the response payloads before returning them to the UI.
- `docs/agent_tools.md` – confirm prompt instructions tell the model how to use the new tools.

## Other Open Threads
- SQLite memory pipeline: `src/app/api/conversation/summarize/route.ts`, `src/lib/conversation/processor.ts`, `data/app.db` (check `conversation_state` + `memory_summary` tables). Address once search is fixed.
- ESLint warning in `src/components/canvas/MermaidPreview.tsx` regarding `svgContainerRef` cleanup.
- Tests: still no automated coverage for the new popup streaming logic or canvas normalization routines.

## Handy Debug Tips
- DevTools console displays `[tool]`, `[canvas]`, and `[memory]` logs; keep it open during sessions.
- The popup transcript/event windows now live-update. If nothing appears, check for blockers (pop-up permissions, window closed detection in `VoiceEventLog.tsx`).
- `GET /api/canvas/excalidraw?sessionId=primary-session` returns the current scene JSON for inspection.

Keep this document updated as you land features or uncover blockers. Thanks!
