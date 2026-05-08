import { taskToCard, type GlassesCard } from "./cards.js";
import type { FusionApiClient } from "./fusion-api-client.js";
import type { TaskColumn } from "./settings.js";

export async function runQuickCapture(
  text: string,
  deps: { apiClient: FusionApiClient; defaultColumn: TaskColumn },
): Promise<{ taskId: string; confirmationCard: GlassesCard }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const title = lines[0] ?? "Quick capture";
  const description = lines.slice(1).join("\n") || "(captured from glasses)";

  const task = await deps.apiClient.createTask({
    title,
    description,
    column: deps.defaultColumn,
  });

  return {
    taskId: task.id,
    confirmationCard: taskToCard(task),
  };
}
