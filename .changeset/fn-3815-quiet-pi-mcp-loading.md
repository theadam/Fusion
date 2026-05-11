---
"@runfusion/fusion": patch
---

Quiet benign Claude Code CLI stderr on clean shutdown by routing it to debug-only logs in `pi-claude-cli`.

This prevents MCP loading/initialization lines from surfacing as warning/error-level entries in the TUI Logs tab when Claude exits cleanly, while preserving warning/error surfacing for non-zero Claude CLI exits and authentication-related failures.
