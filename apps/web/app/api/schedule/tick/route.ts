import { NextRequest } from "next/server";
import { getDueTasks, executeScheduledTask, updateTaskAfterRun } from "@/lib/task-executor";

/**
 * POST /api/schedule/tick
 * Called by an external cron service (cron-job.org, uptimerobot) every minute.
 * Checks for due tasks and executes them.
 */
export async function POST(_req: NextRequest) {
  try {
    const dueTasks = await getDueTasks();
    const results = [];

    for (const task of dueTasks) {
      const result = await executeScheduledTask(task);
      if (result.success) {
        await updateTaskAfterRun(task.id, task.cronExpr);
      }
      results.push({ taskId: task.id, ...result });
    }

    return Response.json({ executed: results.length, results });
  } catch (e: unknown) {
    const err = e as Error;
    return Response.json({ error: err.message }, { status: 500 });
  }
}
