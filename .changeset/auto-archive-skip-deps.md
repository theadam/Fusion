---
"@runfusion/fusion": patch
---

Auto-archive sweep now skips done tasks that still have an active dependent (in triage, todo, in-progress, or in-review). Previously a stale done task could be archived while a downstream task was still pending, wiping its `.fusion/tasks/{id}/` directory and breaking the downstream agent's sibling-spec read. The agent prompt also now instructs falling back to `fn_task_show` when those sibling files aren't on disk.
