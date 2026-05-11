import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTaskStoreTestHarness } from "./store-test-helpers.js";

describe("TaskStore", () => {
  const harness = createTaskStoreTestHarness();

  beforeEach(harness.beforeEach);
  afterEach(harness.afterEach);

  describe("watcher and polling", () => {
    it("cache is updated when polling is active even without fs.watch", async () => {
      await harness.store().watch();

      try {
        const task = await harness.createTestTask();

        const movedEvents: any[] = [];
        harness.store().on("task:moved", (data: any) => movedEvents.push(data));
        await harness.store().moveTask(task.id, "todo");

        expect(movedEvents).toHaveLength(1);
        expect(movedEvents[0].from).toBe("triage");
        expect(movedEvents[0].to).toBe("todo");
      } finally {
        harness.store().stopWatching();
      }
    }, 30_000);

    it("checkForChanges returns a Promise (is async)", async () => {
      await harness.store().watch();
      const result = (harness.store() as any).checkForChanges();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it("pollingInProgress guard prevents overlapping poll cycles", async () => {
      await harness.store().watch();
      const storeAny = harness.store() as any;

      const firstCall = storeAny.checkForChanges();
      const secondCall = storeAny.checkForChanges();

      expect(firstCall).toBeInstanceOf(Promise);
      expect(secondCall).toBeInstanceOf(Promise);

      await Promise.all([firstCall, secondCall]);
      expect(storeAny.pollingInProgress).toBe(false);
    });

    it("logs poll failures with context and keeps checkForChanges non-fatal", async () => {
      await harness.store().watch();

      const storeAny = harness.store() as any;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalGetLastModified = storeAny.db.getLastModified.bind(storeAny.db);
      storeAny.db.getLastModified = vi.fn(() => {
        throw new Error("poll db unavailable");
      });

      try {
        await expect(storeAny.checkForChanges()).resolves.toBeUndefined();
        expect(storeAny.pollingInProgress).toBe(false);

        const pollFailureCall = warnSpy.mock.calls.find(
          (call) =>
            typeof call[0] === "string"
            && call[0].includes("[task-store] checkForChanges poll cycle failed"),
        );
        expect(pollFailureCall).toBeDefined();
        const [, context] = pollFailureCall as [string, Record<string, unknown>];
        expect(context).toMatchObject({
          lastPollTime: storeAny.lastPollTime,
          error: "poll db unavailable",
        });
      } finally {
        storeAny.db.getLastModified = originalGetLastModified;
        warnSpy.mockRestore();
      }
    });

    it("logs watcher failures and keeps polling operational", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        await harness.store().watch();
        const storeAny = harness.store() as any;

        if (storeAny.watcher) {
          storeAny.watcher.emit("error", new Error("watcher degraded"));

          const watcherErrorCall = warnSpy.mock.calls.find(
            (call) => typeof call[0] === "string" && call[0].includes("[task-store] fs.watch emitted an error; polling will continue"),
          );
          expect(watcherErrorCall).toBeDefined();
          const [, context] = watcherErrorCall as [string, Record<string, unknown>];
          expect(context).toMatchObject({ error: "watcher degraded" });
        } else {
          const fallbackCall = warnSpy.mock.calls.find(
            (call) => typeof call[0] === "string" && call[0].includes("[task-store] fs.watch unavailable; falling back to polling-only updates"),
          );
          expect(fallbackCall).toBeDefined();
        }

        await expect(storeAny.checkForChanges()).resolves.toBeUndefined();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("does not emit timing warning when polling is fast (<100ms)", async () => {
      await harness.store().watch();

      const storeAny = harness.store() as any;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        await harness.store().createTask({ description: "fast poll test" });
        await storeAny.checkForChanges();

        const timingWarningEmitted = warnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === "string"
            && call[0].includes("checkForChanges took")
            && call[0].includes("ms"),
        );
        expect(timingWarningEmitted).toBe(false);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
