import { describe, expect, it, vi } from "vitest";
import { requestReview, startWork } from "../agent-actions.js";

describe("agent actions", () => {
  it("moves task to in-progress when enabled", async () => {
    const moveTask = vi.fn(async () => ({ id: "FN-1", title: "Task", description: "", column: "in-progress" }));
    const card = await startWork("FN-1", {
      apiClient: { moveTask } as never,
      enableAgentActions: true,
      logger: console,
    });
    expect(moveTask).toHaveBeenCalledWith("FN-1", "in-progress");
    expect(card?.id).toBe("task-FN-1");
  });

  it("skips when disabled", async () => {
    const moveTask = vi.fn();
    const warn = vi.fn();
    const card = await requestReview("FN-1", {
      apiClient: { moveTask } as never,
      enableAgentActions: false,
      logger: { warn },
    });
    expect(card).toBeUndefined();
    expect(moveTask).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
