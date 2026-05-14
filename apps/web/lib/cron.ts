/**
 * In-process cron scheduler for Next.js
 * Reads jobs from DB, executes at scheduled times, delivers results
 */

import { db, cronJobs, sessions } from "@agent-web/db";
import { eq, and, lte, isNull, sql } from "drizzle-orm";
import { runChatStream } from "@agent-web/core";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  sessionId: string | null;
  enabled: boolean | null;
  lastRun: Date | null;
  nextRun: Date | null;
}

// Simple cron parser - checks if a job should run now
function parseCronSchedule(schedule: string): Date | null {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(/\s+/);

  const now = new Date();
  const next = new Date(now);

  // Simple cases first
  if (schedule.startsWith("*/")) {
    const interval = parseInt(schedule.slice(2).split(" ")[0], 10);
    if (isNaN(interval)) return null;
    next.setMinutes(Math.ceil(now.getMinutes() / interval) * interval);
    next.setSeconds(0);
    next.setMilliseconds(0);
    if (next <= now) next.setMinutes(next.getMinutes() + interval);
    return next;
  }

  // Exact time: "30 14 * * *" = daily at 14:30
  const m = parseInt(minute, 10);
  const h = parseInt(hour, 10);

  if (!isNaN(m) && !isNaN(h)) {
    next.setHours(h, m, 0, 0);
    if (next <= now) {
      // Move to next day or next month depending on dayOfMonth
      if (dayOfMonth !== "*") {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
    }
    return next;
  }

  return null;
}

export async function checkAndRunCronJobs() {
  try {
    const jobs = await db.select().from(cronJobs).where(eq(cronJobs.enabled, true));

    for (const job of jobs) {
      const nextRun = parseCronSchedule(job.schedule);
      if (!nextRun) continue;

      // Update nextRun in DB
      await db.update(cronJobs).set({ nextRun }).where(eq(cronJobs.id, job.id));

      // Check if it's time to run
      if (nextRun <= new Date()) {
        await executeJob(job);
      }
    }
  } catch (e) {
    console.error("Cron check error:", e);
  }
}

async function executeJob(job: CronJob) {
  try {
    // Create a session if none exists
    let sessionId = job.sessionId;
    if (!sessionId) {
      const id = crypto.randomUUID();
      await db.insert(sessions).values({
        id,
        title: `Cron: ${job.name}`,
        model: "gpt-4o-mini",
        provider: "openrouter",
        status: "active",
      });
      sessionId = id;
    }

    // Run the job prompt through the chat engine
    const apiKey = process.env.OPENROUTER_API_KEY ?? "";
    if (!apiKey) {
      console.error("No API key for cron job execution");
      return;
    }

    const result = await runChatStream({
      config: { provider: "openrouter", model: "openai/gpt-4o-mini", apiKey },
      sessionId: sessionId,
      newMessages: [{ role: "user", content: job.prompt }],
      systemPrompt: "You are executing a scheduled task. Complete the task efficiently.",
      enableMemory: false,
    });

    // Save the result
    const resultText = await new Promise<string>((resolve) => {
      let text = "";
      const reader = (result as any).toDataStreamResponse().body?.getReader();
      if (!reader) { resolve(""); return; }

      const decoder = new TextDecoder();
      reader.read().then(function process(result: ReadableStreamReadResult<Uint8Array>) {
        const { done, value } = result;
        if (done) { resolve(text); return; }
        text += decoder.decode(value, { stream: true });
        return reader.read().then(process);
      });
    });

    await db.update(cronJobs).set({
      lastRun: new Date(),
      result: resultText.slice(0, 10000),
      nextRun: parseCronSchedule(job.schedule),
    }).where(eq(cronJobs.id, job.id));

    console.log(`Cron job executed: ${job.name}`);
  } catch (e) {
    console.error(`Cron job failed: ${job.name}`, e);
    await db.update(cronJobs).set({
      lastRun: new Date(),
      result: `Error: ${(e as Error).message}`,
      nextRun: parseCronSchedule(job.schedule),
    }).where(eq(cronJobs.id, job.id));
  }
}

// Start the cron scheduler
let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startCronScheduler() {
  if (cronInterval) return;

  console.log("Starting cron scheduler (checking every 60s)...");
  cronInterval = setInterval(async () => {
    await checkAndRunCronJobs();
  }, 60_000);

  // Run immediately on start
  checkAndRunCronJobs();
}

export function stopCronScheduler() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("Cron scheduler stopped");
  }
}
