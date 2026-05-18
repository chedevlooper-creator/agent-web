import { getDb } from "@agent-web/db";
import { scheduledTasks } from "@agent-web/db/schema";
import { eq, and, lte } from "drizzle-orm";

/**
 * Get all due tasks that should run now.
 */
export async function getDueTasks() {
  const db = getDb();
  const now = Date.now();
  return db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.enabled, 1),
        lte(scheduledTasks.nextRunAt, now)
      )
    );
}

/**
 * Execute a single scheduled task.
 */
export async function executeScheduledTask(task: {
  id: string;
  prompt: string;
  agentId?: string | null;
}): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: task.prompt }],
          provider: "openai",
          model: "gpt-4o-mini",
          agentId: task.agentId || null,
        }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const reader = response.body?.getReader();
    let output = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
      }
    }

    return { success: true, output: output.slice(0, 1000) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Update task's next run time after execution.
 */
export async function updateTaskAfterRun(taskId: string, cronExpr: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const nextRunAt = now + getIntervalFromCron(cronExpr);

  await db
    .update(scheduledTasks)
    .set({
      lastRunAt: now,
      nextRunAt,
      updatedAt: now,
    })
    .where(eq(scheduledTasks.id, taskId));
}

function getIntervalFromCron(cronExpr: string): number {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length >= 5) {
    if (parts[1] === "0" && parts[2] === "0" && parts[3] === "*" && parts[4] === "*" && parts[5] === "*") {
      return 24 * 60 * 60 * 1000;
    }
  }
  return 60 * 60 * 1000;
}
