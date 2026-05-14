import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});
export { client };
export * from "./schema.js";

export async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      provider TEXT NOT NULL DEFAULT 'openai',
      system_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      pinned INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tool_calls TEXT,
      tool_results TEXT,
      meta TEXT,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL DEFAULT 'memory',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'fact',
      importance INTEGER NOT NULL DEFAULT 5,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS provider_models (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      label TEXT,
      context_length INTEGER,
      enabled INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS tool_preferences (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      tool_name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS subagents (
      id TEXT PRIMARY KEY,
      parent_session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      goal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      model TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS subagent_messages (
      id TEXT PRIMARY KEY,
      subagent_id TEXT NOT NULL REFERENCES subagents(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tool_calls TEXT,
      tool_results TEXT,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      prompt TEXT NOT NULL,
      session_id TEXT REFERENCES sessions(id),
      enabled INTEGER DEFAULT 1,
      last_run INTEGER,
      next_run INTEGER,
      result TEXT,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skills_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      frontmatter TEXT,
      category TEXT DEFAULT 'general',
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      version TEXT DEFAULT '1.0.0',
      source TEXT DEFAULT 'local',
      source_url TEXT,
      trust_level TEXT DEFAULT 'community',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS skill_files (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills_new(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tool_audit_log (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      tool_name TEXT NOT NULL,
      arguments TEXT,
      result TEXT,
      success INTEGER,
      duration INTEGER,
      blocked_by TEXT,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL DEFAULT 'stdio',
      command TEXT,
      args TEXT,
      env TEXT,
      url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      tools_include TEXT,
      tools_exclude TEXT,
      tools_prompts INTEGER DEFAULT 1,
      tools_resources INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      arguments TEXT,
      result TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      duration INTEGER,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      arguments TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at INTEGER
    )`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }
}

// Initialize FTS5 session search table
export async function initFts5() {
  try {
    await client.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
        session_id,
        role,
        content,
        tokenize='unicode61'
      );
    `);

    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS messages_after_insert
      AFTER INSERT ON messages
      BEGIN
        INSERT INTO session_search(session_id, role, content)
        VALUES (NEW.session_id, NEW.role, NEW.content);
      END;
    `);

    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS messages_after_update
      AFTER UPDATE ON messages
      BEGIN
        UPDATE session_search
        SET session_id = NEW.session_id,
            role = NEW.role,
            content = NEW.content
        WHERE rowid = OLD.rowid;
      END;
    `);

    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS messages_after_delete
      AFTER DELETE ON messages
      BEGIN
        DELETE FROM session_search
        WHERE session_id = OLD.session_id
          AND content = OLD.content
          AND rowid = OLD.rowid;
      END;
    `);
  } catch (err) {
    console.error("FTS5 initialization error:", err);
  }
}

export async function searchSessions(query: string, opts?: { limit?: number; sessionId?: string }) {
  const limit = opts?.limit ?? 20;
  const sessionId = opts?.sessionId;

  const escaped = query.replace(/["*]/g, "").trim();
  if (!escaped) return [];

  const whereClause = sessionId
    ? `session_search MATCH '${escaped}' AND session_id = '${sessionId}'`
    : `session_search MATCH '${escaped}'`;

  const results = await client.execute({
    sql: `
      SELECT
        s.id as session_id,
        s.title as session_title,
        m.id as message_id,
        m.role as message_role,
        m.content as message_content,
        m.created_at as message_created_at,
        rank as relevance
      FROM session_search
      JOIN sessions s ON session_search.session_id = s.id
      JOIN messages m ON session_search.rowid = m.rowid
      WHERE ${whereClause}
      ORDER BY rank
      LIMIT ?
    `,
    args: [limit],
  });

  return results.rows.map((row: any) => ({
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    messageId: row.message_id,
    messageRole: row.message_role,
    messageContent: row.message_content,
    messageCreatedAt: row.message_created_at,
    relevance: row.relevance,
  }));
}

export async function getMemoryUsage() {
  const memoryResult = await client.execute({
    sql: "SELECT COALESCE(SUM(length(value)), 0) as total FROM memory_entries WHERE target = 'memory'",
    args: [],
  });

  const userResult = await client.execute({
    sql: "SELECT COALESCE(SUM(length(value)), 0) as total FROM memory_entries WHERE target = 'user'",
    args: [],
  });

  return {
    memory: (memoryResult.rows[0] as any)?.total ?? 0,
    user: (userResult.rows[0] as any)?.total ?? 0,
    memoryLimit: parseInt(process.env.MEMORY_CHAR_LIMIT ?? "2200", 10),
    userLimit: parseInt(process.env.USER_CHAR_LIMIT ?? "1375", 10),
  };
}
