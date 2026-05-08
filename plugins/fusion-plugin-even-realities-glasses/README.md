# Even Realities Glasses Plugin (Fusion)

`@fusion-plugin-examples/even-realities-glasses` is a standalone Fusion plugin that provides a task-centric card workflow for Even Realities glasses.

## Scope (v1)

- Read board/task status through Fusion dashboard HTTP APIs (`/api/tasks*`)
- Quick capture text into new tasks
- Polling-based task transition notifications
- Agent actions: start work (`in-progress`) and request review (`in-review`)

Out of scope in v1: missions, roadmaps, search, multi-project routing, cloud/remote deployment orchestration.

## Install (workspace local)

From repo root:

```bash
pnpm install
pnpm --filter @fusion-plugin-examples/even-realities-glasses build
pnpm --filter @fusion-plugin-examples/even-realities-glasses test
```

## Required settings

- `fusionApiBaseUrl` (default `http://localhost:4040`)
- `fusionApiToken` (required Bearer token)
- `glassesDeviceId` (optional identifier)
- `pollingIntervalSeconds` (default 30, min 5)
- `notifyOnColumns` (default `["in-review"]`)
- `quickCaptureDefaultColumn` (default `triage`)
- `enableAgentActions` (default `true`)

## Security notes

- Uses `Authorization: Bearer <token>` for all API requests.
- Prefer local/self-hosted Fusion instances and avoid exposing dashboard APIs to public networks.
- Treat `fusionApiToken` as secret material and rotate regularly.

## Transport extension point

The plugin intentionally uses `GlassesTransport` + `StubGlassesTransport` for now. The real Even Realities BLE/SDK transport should be wired behind this interface.

Dependency research task FN-3737 was not available in this task runtime, so no concrete protocol implementation is included yet. Integrate the real SDK by replacing the stub transport in `src/index.ts` while keeping route + notifier behavior unchanged.
