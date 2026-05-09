---
"@runfusion/fusion": patch
---

Permanent-agent heartbeats can no longer be deadlocked by an approval policy interposing on `fn_heartbeat_done`. The terminal heartbeat-completion tool now bypasses both the action gate and the permanent-agent gate by reference, so even a misconfigured policy or classification-table regression cannot strand a heartbeat run. No user-visible behavior change for correctly classified deployments.
