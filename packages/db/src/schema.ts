import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rootPath: text("root_path").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  branchId: text("branch_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  model: text("model"),
  parentId: text("parent_id"),
  branchRootId: text("branch_root_id"),
  timestamp: integer("timestamp").notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));

export const apiKeys = sqliteTable("api_keys", {
  provider: text("provider").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.provider, table.userId] }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").unique(),
  avatarUrl: text("avatar_url"),
  provider: text("provider", { enum: ["google", "github", "credentials"] }).default("credentials"),
  providerId: text("provider_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const obsidianConfig = sqliteTable("obsidian_config", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vaultPath: text("vault_path").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId] }),
}));

export type ObsidianConfig = typeof obsidianConfig.$inferSelect;
export type NewObsidianConfig = typeof obsidianConfig.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;

export const memoryCategories = [
  "user_info",
  "preference",
  "fact",
  "task_context",
  "conversation_summary",
] as const;

export type MemoryCategory = (typeof memoryCategories)[number];

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category", { enum: memoryCategories }).notNull().default("fact"),
  importance: integer("importance").notNull().default(3),
  context: text("context"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const knowledgeBases = sqliteTable("knowledge_bases", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const knowledgeDocuments = sqliteTable("knowledge_documents", {
  id: text("id").primaryKey(),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull().default("text"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

// ===== Agent Marketplace =====

export const agentCategories = [
  "coding",
  "writing",
  "research",
  "creative",
  "productivity",
  "analysis",
  "general",
] as const;

export type AgentCategory = (typeof agentCategories)[number];

export const agentPresets = sqliteTable("agent_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: agentCategories }).notNull().default("general"),
  tags: text("tags").notNull().default(""),
  avatar: text("avatar"),
  systemPrompt: text("system_prompt").notNull(),
  tools: text("tools").notNull().default(""),
  model: text("model"),
  provider: text("provider"),
  temperature: real("temperature").default(0.7),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  installs: integer("installs").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const installedAgents = sqliteTable("installed_agents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  presetId: text("preset_id")
    .notNull()
    .references(() => agentPresets.id, { onDelete: "cascade" }),
  customName: text("custom_name"),
  customPrompt: text("custom_prompt"),
  customModel: text("custom_model"),
  customProvider: text("custom_provider"),
  customTemperature: real("custom_temperature"),
  customTools: text("custom_tools"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type AgentPreset = typeof agentPresets.$inferSelect;
export type NewAgentPreset = typeof agentPresets.$inferInsert;
export type InstalledAgent = typeof installedAgents.$inferSelect;
export type NewInstalledAgent = typeof installedAgents.$inferInsert;

// ===== Agent Groups =====

export const agentGroups = sqliteTable("agent_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull().references(() => users.id),
  agents: text("agents").notNull(), // JSON array of { presetId, role, order }
  strategy: text("strategy").notNull().default("parallel"), // parallel | sequential | debate
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type AgentGroup = typeof agentGroups.$inferSelect;
export type NewAgentGroup = typeof agentGroups.$inferInsert;

// ===== Scheduled Tasks =====

export const scheduledTasks = sqliteTable("scheduled_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  agentId: text("agent_id"),
  prompt: text("prompt").notNull(),
  cronExpr: text("cron_expr").notNull(),
  enabled: integer("enabled").notNull().default(1),
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type NewScheduledTask = typeof scheduledTasks.$inferInsert;

// ===== Teams / Workspace =====

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  teamId: text("team_id").notNull().references(() => teams.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // owner | admin | member
  joinedAt: integer("joined_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.teamId, table.userId] }),
}));

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

// ===== Shared Sessions =====

export const sharedSessions = sqliteTable("shared_sessions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  userId: text("user_id").notNull().references(() => users.id),
  shareToken: text("share_token").notNull().unique(),
  title: text("title").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
});

export type SharedSession = typeof sharedSessions.$inferSelect;
export type NewSharedSession = typeof sharedSessions.$inferInsert;
