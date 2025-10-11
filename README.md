# Virtual Solutions Architect

Voice-first web application that blends OpenAI's realtime agents with AWS Bedrock AgentCore to design, visualise, and deploy cloud architectures collaboratively.

## Project Structure

- `src/app` – Next.js App Router pages and API routes.
- `src/components/voice` – WebRTC-focused UI components.
- `src/lib/openai` – Client utilities for OpenAI realtime sessions.

## Getting Started

1. **Install dependencies** (requires internet access). After pulling new changes, rerun this command to install Mermaid and JS DOM rendering support:
   ```bash
   npm install
   ```
2. **Copy environment file**:
   ```bash
   cp .env.example .env.local
   ```
3. **Fill in secrets**:
   - `OPENAI_API_KEY` with a key that has realtime access.
   - `OPENAI_REALTIME_MODEL` and optional `OPENAI_REALTIME_VOICE` for preferred persona.
   - `VOICE_TOKEN_ALLOWED_ORIGINS` set to the web origins permitted to request realtime sessions (comma separated).
   - Set `AWS_KNOWLEDGE_MCP_ENABLED=true` to allow the agent to call the hosted AWS Knowledge MCP server. Override `AWS_KNOWLEDGE_MCP_URL` if you proxy the service.
  - Provide `TAVILY_API_KEY` to enable live web search via Tavily. (Optional) Override the API host with `TAVILY_API_BASE_URL`.
   - The AWS Diagram MCP now runs co-located by default. Ensure `uv` (Astral) and Graphviz are installed so `uvx awslabs.aws-diagram-mcp-server` can execute. Only set `AWS_DIAGRAM_MCP_MODE=remote` (and `AWS_DIAGRAM_MCP_URL`) if you want to hit an external HTTP bridge; otherwise no additional configuration is required.
   - (Optional) Configure long-term memory with SQLite. Download the [`sqlite-vec`](https://github.com/asg017/sqlite-vec) extension and set `SQLITE_VEC_PATH` to the shared library so cosine search can be performed inside the database. The SQLite database lives at `data/app.db` and is created automatically.
   - To stream desktop captures to the realtime agent, expose your dev server over HTTPS and set `APP_BASE_URL` (or `NEXT_PUBLIC_APP_URL`) to the public origin. See **Screen Share over HTTPS** below for an ngrok walkthrough.
   - AWS, GitHub, and Claude settings when those integrations come online.
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to access the interface.

## Screen Share over HTTPS

The realtime API will only ingest `input_image` URLs served over HTTPS. During local development you can tunnel your Next.js server with ngrok (or any similar tool) and forward that origin to the app:

1. Install ngrok and sign in so HTTPS tunnels are enabled: <https://ngrok.com/download>.
2. Start the tunnel against your dev server port:
   ```bash
   ngrok http --domain=<your-subdomain>.ngrok.app 3000
   ```
   ngrok will print a public `https://...ngrok.app` URL.
3. Export that domain before launching the Next.js server so screenshot routes build absolute URLs:
   ```bash
   export APP_BASE_URL="https://<your-subdomain>.ngrok.app"
   npm run dev
   ```
   (If you prefer, add the variable to `.env.local` instead of exporting it each time.)
4. When you toggle screen sharing in the UI, frames are now saved to `data/screenshots` and streamed to the model using the HTTPS ngrok link. The control channel stays open because only the URL is sent—no more multi-hundred-kilobyte base64 payloads.

Remember to restart `npm run dev` whenever the public tunnel URL changes.

## Voice Workflow Roadmap

- `/api/voice/token` now issues ephemeral OpenAI session credentials only to approved origins and seeds the session with canvas tool definitions.
- `/api/voice/sdp` proxies WebRTC offer/answer exchange so browser clients do not call OpenAI directly.
- Realtime control-channel events feed transcripts, debugging logs, and canvas commands into the UI.
- Upcoming work: multi-modal tool responses (AWS Diagram MCP, deployment triggers) surfaced directly in the conversation.

## AWS AgentCore Roadmap

- Provision AgentCore Runtime, Identity, and Memory stacks using infrastructure-as-code.
- Register canvas and deployment automation tools behind the AgentCore Gateway.
- Expose observability via CloudWatch and OpenTelemetry collectors.

## Deployment Container Baseline

Use an `amazonlinux:2023` image with:
- Python 3.11 + AWS CLI v2 for orchestration scripts.
- Node.js 20 for build tooling and Mermaid diagram generation.
- Anthropic Claude client and prompts for infrastructure deployment automation.

## Status

Voice conversations stream transcripts in real time, the agent prompt is primed to call canvas tools, and Mermaid commands render to SVG previews. MCP integrations now cover AWS Knowledge (official documentation), Tavily (live web search/extraction), and co-located Excalidraw/AWS Diagram servers. Remote HTTP bridges remain optional via `EXCALIDRAW_MCP_MODE=remote` / `AWS_DIAGRAM_MCP_MODE=remote`. A lightweight SQLite-backed memory service keeps recent summaries, TODOs, and vector-searchable highlights so returning users can pick up where they left off. Next milestones include Excalidraw scene management hardening and Claude-driven deployments.
