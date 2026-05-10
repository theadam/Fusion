---
"@runfusion/fusion": minor
---

Add plugin signature verification and publisher trust policy controls across plugin install/load workflows. Plugin status now exposes publisher identity, key fingerprint, and verification state, with new trust-management and verification commands plus project-level `pluginTrustPolicy` enforcement modes (`off`, `warn`, `enforce`).
