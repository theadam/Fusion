---
"@runfusion/fusion": patch
---

Bump `@mariozechner/pi-ai` and `@mariozechner/pi-coding-agent` from 0.70.0 to 0.72.1 across cli, dashboard, and engine. This refreshes the built-in model catalog (`pi-ai/dist/models.generated.js`) that feeds Fusion's `ModelRegistry`, picking up the latest provider/model entries (Anthropic, OpenAI, Codex, Bedrock, etc.) generated from upstream `models.dev`. No Fusion-side API changes.
