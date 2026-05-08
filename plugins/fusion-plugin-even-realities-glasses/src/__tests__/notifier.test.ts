import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotifier } from "../notifier.js";

afterEach(() => {
  vi.useRealTimers();
});

function createDbMock(seed: Array<{ taskId: string; lastColumn: string }> = []) {
  const run = vi.fn();
  return {
    run,
    db: {
      prepare: (sql: string) => ({
        all: () => (sql.includes("SELECT") ? seed : []),
        run,
      }),
    },
  };
}

describe("notifier", () => {
  it("notifies only on transitions after initial load", async () => {
    vi.useFakeTimers();
    const listTasks = vi
      .fn()
      .mockResolvedValueOnce([{ id: "FN-1", title: "Task", description: "", column: "todo" }])
      .mockResolvedValueOnce([{ id: "FN-1", title: "Task", description: "", column: "in-review" }])
      .mockResolvedValueOnce([{ id: "FN-1", title: "Task", description: "", column: "in-review" }]);
    const pushCard = vi.fn(async () => undefined);
    const { db } = createDbMock();

    const notifier = createNotifier({
      apiClient: { listTasks } as never,
      transport: { pushCard } as never,
      getSettings: () => ({ pollingIntervalMs: 1000, notifyColumns: ["in-review"] }),
      logger: console,
      db,
    });

    notifier.start();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(pushCard).toHaveBeenCalledTimes(1);
    notifier.stop();
  });

  it("hydrates from db and catches poll errors", async () => {
    vi.useFakeTimers();
    const listTasks = vi.fn().mockRejectedValue(new Error("boom"));
    const error = vi.fn();
    const { db } = createDbMock([{ taskId: "FN-1", lastColumn: "todo" }]);
    const notifier = createNotifier({
      apiClient: { listTasks } as never,
      transport: { pushCard: vi.fn() } as never,
      getSettings: () => ({ pollingIntervalMs: 1000, notifyColumns: ["in-review"] }),
      logger: { warn: vi.fn(), error },
      db,
    });

    notifier.start();
    await vi.runOnlyPendingTimersAsync();
    expect(error).toHaveBeenCalled();
    expect(notifier.getLastSnapshot().get("FN-1")).toBe("todo");
    notifier.stop();
  });
});
