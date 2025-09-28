# Virtual Solutions Architect

Voice-first web application that blends OpenAI's realtime agents with AWS Bedrock AgentCore to design, visualise, and deploy cloud architectures collaboratively.

## Project Structure

- `src/app` – Next.js App Router pages and API routes.
- `src/components/voice` – WebRTC-focused UI components.
- `src/lib/openai` – Client utilities for OpenAI realtime sessions.

## Getting Started

1. **Install dependencies** (requires internet access):
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
   - AWS, GitHub, and Claude settings when those integrations come online.
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to access the interface.

## Voice Workflow Roadmap

- Secure `/api/voice/token` now issues ephemeral OpenAI session credentials only to approved origins.
- `/api/voice/sdp` proxies WebRTC offer/answer exchange so Browser clients do not call OpenAI directly.
- Next step: stream control/channel events (transcripts, canvas commands) over the established data channel.

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

The WebRTC scaffold now negotiates offers via server-side SDP relay and awaits OpenAI responses. Authorize the token endpoint and connect realtime credentials to begin live conversations, then extend with canvas tool integration and Claude deployment automation.
