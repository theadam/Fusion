---
"@runfusion/fusion": patch
---

Fix dashboard user mailbox routing to use deterministic canonical identity normalization so agent replies sent to `dashboard`, `user:dashboard`, or `User: user:dashboard` all land in the dashboard inbox while preserving reply-link metadata.
