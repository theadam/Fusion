---
"@runfusion/fusion": patch
---

Fix stale in-review session/worktree recovery so retries discard mismatched persisted session metadata, recover missing-worktree review failures into runnable state, and unblock downstream todo tasks stalled by stale review blockers.
