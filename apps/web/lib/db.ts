import "server-only";
import { getDb, sessions, messages, projects, users, memories, apiKeys, obsidianConfig, ensureMigrated, listMemoriesByCategory as dbListMemoriesByCategory, getImportantMemories as dbGetImportantMemories, searchMemories as dbSearchMemories, type MemoryCategory, createKnowledgeBase as dbCreateKnowledgeBase, listKnowledgeBases as dbListKnowledgeBases, getKnowledgeBase as dbGetKnowledgeBase, deleteKnowledgeBase as dbDeleteKnowledgeBase, addDocument as dbAddDocument, listDocuments as dbListDocuments, getDocument as dbGetDocument, deleteDocument as dbDeleteDocument, searchKnowledge as dbSearchKnowledge, type KnowledgeBase, type KnowledgeDocument, type SearchResult } from "@agent-web/db";
import { eq, desc, asc, and, gt, gte, isNull, inArray } from "drizzle-orm";

export type Role = "user" | "assistant" | "system";

export interface DbProject {
  id: string;
  userId: string;
  name: string;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
}

export interface DbMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: Role;
  content: string;
  model: string | null;
  timestamp: number;
}

export interface DbSession {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface DbSessionWithMessages extends DbSession {
  messages: DbMessage[];
}

let migrationPromise: Promise<void> | null = null;

async function ready() {
  if (!migrationPromise) {
    migrationPromise = ensureMigrated();
  }
  await migrationPromise;
}

// ===== Auth =====

export function requireUserId(request: Request): string {
  const userId = (request as { userId?: string }).userId;
  if (!userId) throw new Error("Authentication required");
  return userId;
}

export async function getUserById(id: string) {
  await ready();
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

// ===== Projects =====

export async function getProjectById(id: string): Promise<DbProject | null> {
  await ready();
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  return rows[0] ?? null;
}

export async function listProjects(userId: string): Promise<DbProject[]> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
  return rows;
}

export async function createProject(input: {
  id: string;
  userId: string;
  name: string;
  rootPath: string;
}): Promise<DbProject> {
  await ready();
  const db = getDb();
  const now = Date.now();
  const row = {
    id: input.id,
    userId: input.userId,
    name: input.name,
    rootPath: input.rootPath,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(projects).values(row);
  return row;
}

export async function updateProject(
  id: string,
  data: Partial<Pick<DbProject, "name" | "rootPath">>
): Promise<void> {
  await ready();
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof data.name === "string") updates.name = data.name;
  if (typeof data.rootPath === "string") updates.rootPath = data.rootPath;
  await db.update(projects).set(updates).where(eq(projects.id, id));
}

export async function deleteProject(id: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(projects).where(eq(projects.id, id));
}

// ===== Sessions =====

export async function listSessions(userId: string, projectId?: string): Promise<DbSession[]> {
  await ready();
  const db = getDb();
  const where = projectId
    ? and(eq(sessions.userId, userId), eq(sessions.projectId, projectId))
    : and(eq(sessions.userId, userId), isNull(sessions.projectId));
  const rows = await db
    .select()
    .from(sessions)
    .where(where)
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    projectId: r.projectId,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function listSessionsWithMessages(userId: string): Promise<DbSessionWithMessages[]> {
  await ready();
  const db = getDb();

  // Get all sessions for the user in one query
  const sessionsRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.updatedAt));

  if (sessionsRows.length === 0) return [];

  // Batch-load all messages for all sessions in one query
  const sessionIds = sessionsRows.map((s) => s.id);
  const allMessages = await db
    .select()
    .from(messages)
    .where(and(
      inArray(messages.sessionId, sessionIds),
      eq(messages.userId, userId),
    ))
    .orderBy(asc(messages.timestamp));

  // Group messages by sessionId
  const messagesBySession = new Map<string, typeof allMessages>();
  for (const msg of allMessages) {
    const list = messagesBySession.get(msg.sessionId);
    if (list) list.push(msg);
    else messagesBySession.set(msg.sessionId, [msg]);
  }

  return sessionsRows.map((s) => ({
    id: s.id,
    userId: s.userId,
    projectId: s.projectId,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messages: (messagesBySession.get(s.id) || []).map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      userId: m.userId,
      role: m.role as Role,
      content: m.content,
      model: m.model,
      timestamp: m.timestamp,
    })),
  }));
}

export async function getSession(id: string): Promise<DbSession | null> {
  await ready();
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSession(input: {
  id: string;
  userId: string;
  projectId?: string | null;
  title?: string;
}): Promise<DbSession> {
  await ready();
  const db = getDb();
  const now = Date.now();
  const row = {
    id: input.id,
    userId: input.userId,
    projectId: input.projectId ?? null,
    title: input.title || "New Chat",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(sessions).values(row);
  return row;
}

export async function updateSession(
  id: string,
  data: Partial<Pick<DbSession, "title" | "updatedAt">>
): Promise<void> {
  await ready();
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (typeof data.title === "string") updates.title = data.title;
  updates.updatedAt = data.updatedAt ?? Date.now();
  await db.update(sessions).set(updates).where(eq(sessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function listMessages(sessionId: string): Promise<DbMessage[]> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.timestamp));
  return rows.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    userId: m.userId,
    role: m.role as Role,
    content: m.content,
    model: m.model,
    timestamp: m.timestamp,
  }));
}

export async function addMessage(input: {
  id: string;
  sessionId: string;
  userId: string;
  role: Role;
  content: string;
  model?: string | null;
  timestamp?: number;
}): Promise<DbMessage> {
  await ready();
  const db = getDb();
  const row = {
    id: input.id,
    sessionId: input.sessionId,
    userId: input.userId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    timestamp: input.timestamp ?? Date.now(),
  };
  await db.insert(messages).values(row);
  await db
    .update(sessions)
    .set({ updatedAt: row.timestamp })
    .where(eq(sessions.id, input.sessionId));
  return row;
}

export async function updateMessage(
  id: string,
  data: Partial<Pick<DbMessage, "content" | "model">>
): Promise<void> {
  await ready();
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (typeof data.content === "string") updates.content = data.content;
  if (data.model !== undefined) updates.model = data.model;
  await db.update(messages).set(updates).where(eq(messages.id, id));
}

export async function deleteMessage(id: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(messages).where(eq(messages.id, id));
}

export async function deleteMessagesAfter(
  sessionId: string,
  afterTimestamp: number,
  inclusive = false
): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(messages).where(
    and(
      eq(messages.sessionId, sessionId),
      inclusive
        ? gte(messages.timestamp, afterTimestamp)
        : gt(messages.timestamp, afterTimestamp)
    )
  );
}

export async function clearMessages(sessionId: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(messages).where(eq(messages.sessionId, sessionId));
}

export async function importSessions(
  payload: DbSessionWithMessages[]
): Promise<{ sessions: number; messages: number }> {
  await ready();
  const db = getDb();
  let sCount = 0;
  let mCount = 0;

  // Batch-check existing sessions
  const existingSessionIds = payload.length > 0
    ? (await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.id, payload.map((s) => s.id))))
        .map((r) => r.id)
    : [];

  const existingSet = new Set(existingSessionIds);

  for (const s of payload) {
    if (!existingSet.has(s.id)) {
      await db.insert(sessions).values({
        id: s.id,
        userId: s.userId,
        projectId: s.projectId ?? null,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
      sCount++;
    } else {
      await db
        .update(sessions)
        .set({ title: s.title, updatedAt: s.updatedAt })
        .where(eq(sessions.id, s.id));
    }
  }

  // Batch-check existing messages across all sessions
  const allMessageIds = payload.flatMap((s) => s.messages).map((m) => m.id);
  const existingMessageIds = allMessageIds.length > 0
    ? (await db
        .select({ id: messages.id })
        .from(messages)
        .where(inArray(messages.id, allMessageIds)))
        .map((r) => r.id)
    : [];

  const existingMsgSet = new Set(existingMessageIds);

  for (const s of payload) {
    for (const m of s.messages) {
      if (!existingMsgSet.has(m.id)) {
        await db.insert(messages).values({
          id: m.id,
          sessionId: s.id,
          userId: m.userId,
          role: m.role,
          content: m.content,
          model: m.model ?? null,
          timestamp: m.timestamp,
        });
        mCount++;
      }
    }
  }

  return { sessions: sCount, messages: mCount };
}

// ===== Memory CRUD =====

export interface DbMemory {
  id: string;
  userId: string | null;
  key: string;
  value: string;
  category: MemoryCategory;
  importance: number;
  context: string | null;
  createdAt: number;
  updatedAt: number;
}

export async function listMemories(category?: string): Promise<DbMemory[]> {
  await ready();
  const db = getDb();
  const where = category ? eq(memories.category, category as MemoryCategory) : undefined;
  const rows = await db
    .select()
    .from(memories)
    .orderBy(asc(memories.key));
  if (category) {
    const filtered = rows.filter((r) => r.category === category);
    return filtered.map(mapMemory);
  }
  return rows.map(mapMemory);
}

export async function listMemoriesByCategory(
  userId: string,
  category: MemoryCategory
): Promise<DbMemory[]> {
  await ready();
  const rows = await dbListMemoriesByCategory(userId, category);
  return rows.map(mapMemory);
}

export async function getImportantMemories(
  userId: string,
  minImportance: number
): Promise<DbMemory[]> {
  await ready();
  const rows = await dbGetImportantMemories(userId, minImportance);
  return rows.map(mapMemory);
}

export async function searchMemories(
  userId: string,
  query: string
): Promise<DbMemory[]> {
  await ready();
  const rows = await dbSearchMemories(userId, query);
  return rows.map(mapMemory);
}

export async function upsertMemory(input: {
  key: string;
  value: string;
  userId?: string;
  category?: MemoryCategory;
  importance?: number;
  context?: string | null;
}): Promise<DbMemory> {
  await ready();
  const db = getDb();
  const now = Date.now();

  // Check if key already exists
  const existing = await db
    .select()
    .from(memories)
    .where(eq(memories.key, input.key));

  if (existing.length > 0) {
    const updates: Record<string, unknown> = { value: input.value, updatedAt: now };
    if (input.userId !== undefined) updates.userId = input.userId;
    if (input.category !== undefined) updates.category = input.category;
    if (input.importance !== undefined) updates.importance = input.importance;
    if (input.context !== undefined) updates.context = input.context;
    await db.update(memories).set(updates).where(eq(memories.key, input.key));
    return {
      id: existing[0].id,
      userId: (input.userId ?? existing[0].userId) as string | null,
      key: input.key,
      value: input.value,
      category: (input.category ?? existing[0].category) as MemoryCategory,
      importance: (input.importance ?? existing[0].importance) as number,
      context: (input.context !== undefined ? input.context : existing[0].context) as string | null,
      createdAt: existing[0].createdAt,
      updatedAt: now,
    };
  }

  const id = Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
  const row = {
    id,
    userId: input.userId ?? null,
    key: input.key,
    value: input.value,
    category: input.category ?? ("fact" as MemoryCategory),
    importance: input.importance ?? 3,
    context: input.context ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(memories).values(row);
  return mapMemory(row);
}

export async function updateMemoryImportance(
  key: string,
  importance: number
): Promise<DbMemory | null> {
  await ready();
  const db = getDb();
  const existing = await db
    .select()
    .from(memories)
    .where(eq(memories.key, key))
    .limit(1);

  if (existing.length === 0) return null;

  const now = Date.now();
  await db
    .update(memories)
    .set({ importance, updatedAt: now })
    .where(eq(memories.key, key));

  return { ...mapMemory(existing[0]), importance, updatedAt: now };
}

export async function deleteMemory(key: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(memories).where(eq(memories.key, key));
}

function mapMemory(r: {
  id: string;
  userId: string | null;
  key: string;
  value: string;
  category: string;
  importance: number;
  context: string | null;
  createdAt: number;
  updatedAt: number;
}): DbMemory {
  return {
    id: r.id,
    userId: r.userId,
    key: r.key,
    value: r.value,
    category: r.category as MemoryCategory,
    importance: r.importance,
    context: r.context,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ===== API Keys CRUD =====

export async function listApiKeys(userId: string): Promise<{ provider: string; keyPreview: string }[]> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.createdAt));
  return rows.map((r) => ({
    provider: r.provider,
    keyPreview: r.key.slice(0, 8) + "...",
  }));
}

export async function saveApiKey(provider: string, key: string, userId: string): Promise<void> {
  await ready();
  const db = getDb();
  const now = Date.now();
  await db
    .insert(apiKeys)
    .values({ provider, userId, key, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [apiKeys.provider, apiKeys.userId],
      set: { key, updatedAt: now },
    });
}

export async function deleteApiKey(provider: string, userId: string): Promise<void> {
  await ready();
  const db = getDb();
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.provider, provider), eq(apiKeys.userId, userId)));
}

// ===== Obsidian Config CRUD =====

export async function getObsidianConfig(userId: string): Promise<{ vaultPath: string } | null> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(obsidianConfig)
    .where(eq(obsidianConfig.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setObsidianConfig(userId: string, vaultPath: string): Promise<void> {
  await ready();
  const db = getDb();
  const now = Date.now();
  await db
    .insert(obsidianConfig)
    .values({ userId, vaultPath, updatedAt: now })
    .onConflictDoUpdate({
      target: [obsidianConfig.userId],
      set: { vaultPath, updatedAt: now },
    });
}

export async function deleteObsidianConfig(userId: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(obsidianConfig).where(eq(obsidianConfig.userId, userId));
}

// ===== Knowledge Base CRUD =====

export async function createKnowledgeBase(
  userId: string,
  name: string,
  description?: string
): Promise<KnowledgeBase> {
  await ready();
  return dbCreateKnowledgeBase(userId, name, description);
}

export async function listKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
  await ready();
  return dbListKnowledgeBases(userId);
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  await ready();
  return dbGetKnowledgeBase(id);
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await ready();
  return dbDeleteKnowledgeBase(id);
}

// ===== Knowledge Document CRUD =====

export async function addDocument(
  knowledgeBaseId: string,
  userId: string,
  filename: string,
  content: string,
  contentType?: string
): Promise<KnowledgeDocument> {
  await ready();
  return dbAddDocument(knowledgeBaseId, userId, filename, content, contentType);
}

export async function listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
  await ready();
  return dbListDocuments(knowledgeBaseId);
}

export async function getDocument(id: string): Promise<KnowledgeDocument | null> {
  await ready();
  return dbGetDocument(id);
}

export async function deleteDocument(id: string): Promise<void> {
  await ready();
  return dbDeleteDocument(id);
}

// ===== Knowledge Search =====

export async function searchKnowledge(
  userId: string,
  query: string,
  topK?: number,
  baseIds?: string[]
): Promise<SearchResult[]> {
  await ready();
  return dbSearchKnowledge(userId, query, topK, baseIds);
}
