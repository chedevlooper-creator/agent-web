import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@libsql/client";

const MAX_ROWS = 100;
const MAX_OUTPUT = 10_000;

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s;
  return s.slice(0, MAX_OUTPUT) + `\n\n[... truncated ...]`;
}

export const dbQueryTool = tool({
  description:
    "Execute read-only SQL queries against the local SQLite database. Only SELECT queries are allowed. Use for exploring data, debugging, and analysis.",
  parameters: z.object({
    query: z.string().describe("SQL SELECT query to execute. Must start with SELECT (case-insensitive)."),
    maxRows: z.number().min(1).max(500).optional().describe(`Max rows to return (default ${MAX_ROWS})`),
  }),
  execute: async ({ query, maxRows }) => {
    const trimmed = query.trim();
    const upper = trimmed.toUpperCase();

    if (!upper.startsWith("SELECT") && !upper.startsWith("PRAGMA") && !upper.startsWith("EXPLAIN")) {
      return "[error] Only SELECT, PRAGMA, and EXPLAIN queries are allowed. Write operations are blocked.";
    }

    const limit = maxRows ?? MAX_ROWS;
    const dbUrl = process.env.DATABASE_URL || "file:./packages/db/data/local.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    try {
      const client = createClient({
        url: dbUrl,
        ...(authToken ? { authToken } : {}),
      });

      const result = await client.execute(trimmed);
      await client.close();

      if (!result.rows || result.rows.length === 0) {
        return "(no results)";
      }

      const rows = result.rows.slice(0, limit);
      const truncated = result.rows.length > limit;

      // Format as simple table
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const lines: string[] = [];

      // Header
      lines.push("| " + headers.join(" | ") + " |");
      lines.push("| " + headers.map(() => "---").join(" | ") + " |");

      // Rows
      for (const row of rows) {
        const vals = headers.map((h) => {
          const v = (row as Record<string, unknown>)[h];
          if (v === null) return "NULL";
          return String(v).slice(0, 120);
        });
        lines.push("| " + vals.join(" | ") + " |");
      }

      lines.push("");
      lines.push(`(${rows.length} row${rows.length !== 1 ? "s" : ""} returned` + (truncated ? `, ${result.rows.length - limit} more not shown` : "") + ")");

      return truncate(lines.join("\n"));
    } catch (e: unknown) {
      const err = e as { message?: string };
      return `[error] Query failed: ${err.message ?? "unknown error"}`;
    }
  },
});
