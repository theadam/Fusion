---
"@runfusion/fusion": patch
---

Fire pi `session_shutdown` extension events when Fusion-spawned `AgentSession` instances are disposed, so extensions registered with `pi.on("session_shutdown", …)` run cleanup handlers (including Fusion's dashboard child-process cleanup).
