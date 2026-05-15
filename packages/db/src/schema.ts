import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("New Chat"),
  model: text("model").notNull().default("gpt-4o-mini"),
  provider: text("provider").notNull().default("openai"),
  systemPrompt: text("system_prompt"),
  status: text("status", { enum: ["active", "archived", "running"] }).notNull().default("active"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  tags: text("tags"), // comma-separated
  messageCount: integer("message_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
  content: text("content").notNull().default(""),
  toolCalls: text("tool_calls"), // JSON
  toolResults: text("tool_results"), // JSON
  meta: text("meta"), // JSON: tokens, latency, model info
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const memoryEntries = sqliteTable("memory_entries", {
  id: text("id").primaryKey(),
  target: text("target", { enum: ["memory", "user"] }).notNull().default("memory"), // MEMORY.md or USER.md
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category", { enum: ["user_pref", "fact", "task", "insight", "project"] }).notNull().default("fact"),
  importance: integer("importance").notNull().default(5), // 1-10
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  sourceMessageId: text("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Agent-configurable provider models
export const providerModels = sqliteTable("provider_models", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  label: text("label"),
  contextLength: integer("context_length"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
});

// Tool execution preferences
export const toolPreferences = sqliteTable("tool_preferences", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  toolName: text("tool_name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
});

// Subagent messages (separate from main session messages)
export const subagentMessages = sqliteTable("subagent_messages", {
  id: text("id").primaryKey(),
  subagentId: text("subagent_id")
    .notNull()
    .references(() => subagents.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
  content: text("content").notNull().default(""),
  toolCalls: text("tool_calls"),
  toolResults: text("tool_results"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
});

// Cron jobs for scheduled agent tasks
export const cronJobs = sqliteTable("cron_jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  schedule: text("schedule").notNull(), // cron expression
  prompt: text("prompt").notNull(),
  sessionId: text("session_id").references(() => sessions.id),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  lastRun: integer("last_run", { mode: "timestamp" }),
  nextRun: integer("next_run", { mode: "timestamp" }),
  result: text("result"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
});

// Skill metadata (new SKILL.md format)
export const skills_new = sqliteTable("skills_new", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  content: text("content").notNull(), // SKILL.md markdown body
  frontmatter: text("frontmatter"), // JSON: tags, category, platforms, version, fallback_for_toolsets
  category: text("category").default("general"),
  usageCount: integer("usage_count").default(0),
  successCount: integer("success_count").default(0),
  version: text("version").default("1.0.0"),
  source: text("source").default("local"), // local, hub, official
  sourceUrl: text("source_url"),
  trustLevel: text("trust_level", { enum: ["builtin", "official", "trusted", "community"] }).default("community"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
});

// Skill files (supporting files like references/, scripts/, templates/)
export const skillFiles = sqliteTable("skill_files", {
  id: text("id").primaryKey(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills_new.id, { onDelete: "cascade" }),
  path: text("path").notNull(), // relative path within skill directory
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
});

// Tool execution audit log (detailed)
export const toolAuditLog = sqliteTable("tool_audit_log", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments"),
  result: text("result"),
  success: integer("success", { mode: "boolean" }),
  duration: integer("duration"),
  blockedBy: text("blocked_by"), // security rule that blocked
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`CURRENT_TIMESTAMP`),
});

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  transport: text("transport", { enum: ["stdio", "sse", "websocket"] }).notNull().default("stdio"),
  command: text("command"),
  args: text("args"), // JSON array
  env: text("env"), // JSON object
  url: text("url"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  toolsInclude: text("tools_include"), // JSON array - whitelist
  toolsExclude: text("tools_exclude"), // JSON array - blacklist
  toolsPrompts: integer("tools_prompts", { mode: "boolean" }).default(true),
  toolsResources: integer("tools_resources", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const subagents = sqliteTable("subagents", {
  id: text("id").primaryKey(),
  parentSessionId: text("parent_session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).notNull().default("pending"),
  result: text("result"),
  model: text("model"),
  provider: text("provider"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const toolExecutions = sqliteTable("tool_executions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments"), // JSON
  result: text("result"),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  duration: integer("duration"), // ms
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const pendingApprovals = sqliteTable("pending_approvals", {
  id: text("id").primaryKey(), // Using the tool call ID
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments"), // JSON string
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type NewMemoryEntry = typeof memoryEntries.$inferInsert;
export type Skill = typeof skills_new.$inferSelect;
export type NewSkill = typeof skills_new.$inferInsert;
export type SkillFile = typeof skillFiles.$inferSelect;
export type NewSkillFile = typeof skillFiles.$inferInsert;
export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
export type Subagent = typeof subagents.$inferSelect;
export type NewSubagent = typeof subagents.$inferInsert;
export type ToolExecution = typeof toolExecutions.$inferSelect;
export type NewToolExecution = typeof toolExecutions.$inferInsert;
export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;
export type ToolPreference = typeof toolPreferences.$inferSelect;
export type NewToolPreference = typeof toolPreferences.$inferInsert;
export type SubagentMessage = typeof subagentMessages.$inferSelect;
export type NewSubagentMessage = typeof subagentMessages.$inferInsert;
export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;
export type ToolAuditLog = typeof toolAuditLog.$inferSelect;
export type NewToolAuditLog = typeof toolAuditLog.$inferInsert;
export type PendingApprovalDB = typeof pendingApprovals.$inferSelect;
export type NewPendingApprovalDB = typeof pendingApprovals.$inferInsert;

// Documents
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), // stored filename on disk
  originalName: text("original_name").notNull(), // original filename with extension
  mimeType: text("mime_type").notNull(),
  extension: text("extension").notNull(), // pdf, docx, xlsx, etc.
  fileSize: integer("file_size").notNull(), // size in bytes
  storagePath: text("storage_path").notNull(), // path to file on disk
  content: text("content"), // cached text content
  metadata: text("metadata"), // JSON: author, pages, etc.
  uploadedAt: integer("uploaded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  storagePath: text("storage_path").notNull(),
  changeSummary: text("change_summary"), // AI-generated summary of changes
  createdBy: text("created_by", { enum: ["user", "ai"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
