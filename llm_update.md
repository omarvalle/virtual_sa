# LLM Update Notes

Welcome aboard! Here is the fastest way to get familiar with this project and the outstanding issue.

## Priority Files to Review
- `README.md` – High-level overview, stack choices, and current status.
- `docs/agent_tools.md` – Function tool schemas for Mermaid, Excalidraw, and AWS diagram commands.
- `docs/voice_prompt_instructions.md` – Prompt guidance for the voice agent.
- `src/lib/openai/prompt.ts` – Actual prompt text sent to OpenAI; mirrors the doc above.
- `src/lib/openai/events.ts` – Realtime event parser; converts control-channel messages into transcripts and function calls.
- `src/components/voice/VoiceSessionPanel.tsx` – Frontend that handles voice session state, posts canvas commands, and logs events.
- `src/app/api/canvas/events/route.ts` – Backend endpoint accepting all canvas commands (Mermaid + Excalidraw). It now interprets loosely structured Excalidraw requests.
- `src/lib/canvas/canvasState.ts` & `src/lib/canvas/excalidrawState.ts` – In-memory stores for commands and simplified Excalidraw shapes.
- `src/components/canvas/ExcalidrawPreview.tsx` – Renders the captured shapes into an SVG preview.
- `src/components/canvas/MermaidPreview.tsx` – Client-side Mermaid renderer that shows diagrams generated via `canvas_update_mermaid`.

## Current Issue: Missing Visuals on Canvas Preview
- Voice agent successfully calls `canvas_update_mermaid`, and those diagrams appear in the Mermaid preview.
- When the agent calls `canvas_patch_excalidraw`, the backend receives the command but our fallback logic may still fail to render shapes (e.g., when payloads only mention ";simple circle" or host custom fields).
- Repro: Ask the agent “draw a simple circle on the canvas.” Observe `/api/canvas/events` handling in the console (warnings should appear) and check `ExcalidrawPreview` for shapes.
- Goal: Ensure minimal instructions (shape + location) produce visible shapes without manual refresh/structure.

## Suggested Starting Points
1. Inspect recent logs from `VoiceSessionPanel` (especially `canvas.warning` entries) to see how commands are interpreted.
2. Confirm `applyExcalidrawOperations` is invoked with meaningful operations (use debugging or console prints if needed).
3. Enhance fallback logic or add normalization to map common agent payloads (e.g., `{ "type": "draw", "shape": "circle" }`) into formal operations.
4. Optionally add auto-refresh/polling to `ExcalidrawPreview` so shape updates appear without a manual refresh.

Once you’re comfortable with the flow, focus on closing the gap between the agent’s output and the shapes we render. Let us know what else you discover!
