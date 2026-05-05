---
"@runfusion/fusion": patch
---

Auto-pause unresponsive agents with `pauseReason: "heartbeat-unresponsive"` and immediately auto-resume them through the shared heartbeat monitor lifecycle, including consistent assigned-task pause/unpause behavior and single on-demand restart semantics.