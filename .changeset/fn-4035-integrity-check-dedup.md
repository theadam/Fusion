---
"@runfusion/fusion": patch
---

Deduplicate background SQLite integrity checks per database path so multi-project dashboard startup no longer stacks repeated `PRAGMA integrity_check(100)` runs against the same `fusion.db`. Health state fanout is preserved for all participating database instances (`integrityCheckPending`, `integrityCheckLastRunAt`, `corruptionDetected`).
