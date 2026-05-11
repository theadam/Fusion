---
"@runfusion/fusion": patch
---

Merger verification now runs `scripts/ensure-test-artifacts.mjs` as a preamble
and self-heals "Failed to resolve entry for package <pkg>" failures by
rebuilding the missing workspace package once before retrying. Unrecoverable
environment faults no longer increment `verificationFailureCount` or bounce
the task to `in-progress` — they remain in-review for the next sweep.
