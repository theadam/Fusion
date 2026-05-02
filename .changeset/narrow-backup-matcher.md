---
"@runfusion/fusion": patch
---

Tighten the in-process backup matcher to the `backup --create` form only and run `fn`/`fusion`/`runfusion.ai` `--version` probes from a temp directory. Previously any subcommand starting with `fn backup` (e.g. `--list`, `--cleanup`, `--restore`) was intercepted by the in-process runner that only knows how to create backups, so a scheduled list/cleanup/restore would silently execute a create instead. The interception now also applies to step-based automations, not just the legacy single-command form. The `--version` probe used by the dashboard fn-binary status route now spawns with `cwd=tmpdir()` so an outdated globally-installed CLI cannot drop a stray `.fusion/.fusion/` tree in the parent project's directory while the probe is running.
