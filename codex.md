# Codex Scratchpad

## Known Tripwires
- **Backticks inside template strings**: Escape inline code markers in `VOICE_AGENT_INSTRUCTIONS` (and any other backtick-delimited text) with `\`` so Next's SWC parser doesn't throw `Expected a semicolon`.
- **Realtime tool payloads**: `canvas_request_excalidraw_operations` must include both `operation` and `payload` to avoid empty requests hitting the MCP wrapper.
- **Excalidraw prompts**: remind yourself (and the agent) that `points` are relative offsets, triangle == `freedraw`, and colors use `strokeColor`/`backgroundColor`/`fillStyle`.
- **MCP modes**: `EXCALIDRAW_MCP_MODE` defaults to local; flip to `remote` only when you need the HTTP wrapper.

## TODO
- keep this list up to date as new recurring issues surface.
