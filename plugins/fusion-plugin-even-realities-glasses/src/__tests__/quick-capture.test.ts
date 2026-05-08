import { describe, expect, it, vi } from "vitest";
import { runQuickCapture } from "../quick-capture.js";

describe("runQuickCapture", () => {
  it("uses first line as title and rest as description", async () => {
    const createTask = vi.fn(async (input) => ({ id: "FN-1", ...input }));
    const result = await runQuickCapture("Title\nDetail line", {
      apiClient: { createTask } as never,
      defaultColumn: "triage",
    });

    expect(createTask).toHaveBeenCalledWith({ title: "Title", description: "Detail line", column: "triage" });
    expect(result.taskId).toBe("FN-1");
  });

  it("uses description fallback", async () => {
    const createTask = vi.fn(async (input) => ({ id: "FN-2", ...input }));
    await runQuickCapture("Only title", { apiClient: { createTask } as never, defaultColumn: "todo" });
    expect(createTask).toHaveBeenCalledWith({ title: "Only title", description: "(captured from glasses)", column: "todo" });
  });
});
