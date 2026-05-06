---
"@fusion/core": minor
"@fusion/engine": minor
"@runfusion/fusion": minor
"@fusion/dashboard": minor
---

Decouple permanent agent heartbeats from task state, and add per-agent `allowParallelExecution` setting.

Heartbeats now run for permanent agents regardless of bound-task block state — the prior early-exit on `queued + blockedBy` is removed along with its dead state-tracking machinery. `HEARTBEAT_SYSTEM_PROMPT` is rewritten to scope heartbeats to ambient coordination (messaging, memory, finding work, delegation, surfacing/chasing blockers, status); task body work continues to run via the executor path. Ephemeral agents are unchanged — they don't run heartbeats and their blocked-task gating in the scheduler is untouched.

New `allowParallelExecution` flag (default `true`, permanent agents only) on `AgentHeartbeatConfig`. When `false`, the heartbeat and task executor paths serialize symmetrically: a heartbeat will not start while the agent's bound task has an active executor session, and an executor session will not start while the agent has an active heartbeat run. Either side re-dispatches the other's deferred work on completion via `resumeTaskForAgent` and the in-process runtime's `onRunCompleted` hook.

UI toggle surfaces in the agent's Heartbeat Settings tab alongside `runMissedHeartbeatOnStartup`.
