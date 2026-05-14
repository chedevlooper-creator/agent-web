import { ensureSchema, initFts5 } from "@agent-web/db";
import { startCronScheduler } from "./cron";

// Server-side initialization
// This runs once when the server starts

let initialized = false;

export async function initializeServer() {
  if (initialized) return;
  initialized = true;

  console.log("[Agent Web] Initializing server...");

  try {
    await ensureSchema();
    console.log("[Agent Web] Database schema ready");
  } catch (e) {
    console.error("[Agent Web] Schema initialization failed:", e);
  }

  // Initialize FTS5 full-text search (after base tables exist)
  try {
    await initFts5();
    console.log("[Agent Web] FTS5 search initialized");
  } catch (e) {
    console.error("[Agent Web] FTS5 initialization failed:", e);
  }

  // Start cron scheduler
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_CRON === "true") {
    startCronScheduler();
    console.log("[Agent Web] Cron scheduler started");
  }

  console.log("[Agent Web] Server initialization complete");
}
