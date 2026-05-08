import { notificationCard } from "./cards.js";
import type { FusionApiClient, FusionTask } from "./fusion-api-client.js";
import type { GlassesTransport } from "./transport.js";

type NotifierSettings = { pollingIntervalMs: number; notifyColumns: string[] };

type PluginDb = {
  prepare(sql: string): {
    all(...args: unknown[]): unknown;
    run(...args: unknown[]): unknown;
  };
};

export function createNotifier({
  apiClient,
  transport,
  getSettings,
  logger,
  db,
  now = () => new Date().toISOString(),
}: {
  apiClient: FusionApiClient;
  transport: GlassesTransport;
  getSettings: () => NotifierSettings;
  logger: Pick<Console, "warn" | "error">;
  db: PluginDb;
  now?: () => string;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let inFlight = false;
  let lastPollTime: string | undefined;
  let lastSnapshot = new Map<string, string>();

  const hydrateSnapshot = () => {
    const rows = db.prepare("SELECT taskId, lastColumn FROM even_realities_seen_tasks").all() as
      | Array<{ taskId: string; lastColumn: string }>
      | undefined;
    for (const row of rows ?? []) {
      if (typeof row.taskId === "string" && typeof row.lastColumn === "string") {
        lastSnapshot.set(row.taskId, row.lastColumn);
      }
    }
  };

  const persistTask = (taskId: string, lastColumn: string) => {
    db.prepare(`
      INSERT INTO even_realities_seen_tasks(taskId, lastColumn, updatedAt)
      VALUES(?, ?, ?)
      ON CONFLICT(taskId) DO UPDATE SET lastColumn = excluded.lastColumn, updatedAt = excluded.updatedAt
    `).run(taskId, lastColumn, now());
  };

  const poll = async () => {
    if (!running || inFlight) return;
    inFlight = true;
    try {
      const settings = getSettings();
      const tasks = await apiClient.listTasks();
      const notifyColumns = new Set(settings.notifyColumns);
      const nextSnapshot = new Map<string, string>();

      for (const task of tasks) {
        nextSnapshot.set(task.id, task.column);
        const previousColumn = lastSnapshot.get(task.id);
        if (previousColumn !== undefined && previousColumn !== task.column && notifyColumns.has(task.column)) {
          await transport.pushCard(notificationCard(task as FusionTask, "entered notify column"));
        }
        persistTask(task.id, task.column);
      }

      lastSnapshot = nextSnapshot;
      lastPollTime = now();
    } catch (error) {
      logger.error("Notifier poll failed", error);
    } finally {
      inFlight = false;
      if (running) {
        timer = setTimeout(() => {
          void poll();
        }, getSettings().pollingIntervalMs);
      }
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      hydrateSnapshot();
      void poll();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    getLastPollTime() {
      return lastPollTime;
    },
    getLastSnapshot() {
      return new Map(lastSnapshot);
    },
  };
}
