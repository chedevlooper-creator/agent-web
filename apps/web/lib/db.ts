import "server-only";
import { getDb, projects, sessions, messages, apiKeys, ensureMigrated, users, obsidianConfig } from "@agent-web/db";
import { eq, desc, asc, isNull, and, inArray, gt, gte } from "drizzle-orm";
import type { Role } from "@agent-web/core";
import { encrypt, decrypt } from "./crypto";

export type { Role };

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
  const op = inclusive ? gte : gt;
  await db
    .delete(messages)
    .where(
      and(
        eq(messages.sessionId, sessionId),
        op(messages.timestamp, afterTimestamp)
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

// ===== API Keys =====

export interface ApiKeyEntry {
  provider: string;
  keyPreview: string;
  createdAt: number;
  updatedAt: number;
}

export async function listApiKeys(userId: string): Promise<ApiKeyEntry[]> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.provider));
  return rows.map((r) => ({
    provider: r.provider,
    keyPreview: r.key.slice(0, 8) + "...",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function saveApiKey(provider: string, key: string, userId: string): Promise<void> {
  await ready();
  const db = getDb();
  const encrypted = encrypt(key);
  const now = Date.now();
  await db
    .insert(apiKeys)
    .values({
      provider: provider.toLowerCase(),
      userId,
      key: encrypted,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [apiKeys.provider, apiKeys.userId],
      set: { key: encrypted, updatedAt: now },
    });
}

export async function deleteApiKey(provider: string, userId: string): Promise<void> {
  await ready();
  const db = getDb();
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.provider, provider.toLowerCase()), eq(apiKeys.userId, userId)));
}

export async function getApiKey(provider: string, userId: string): Promise<string | null> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.provider, provider.toLowerCase()), eq(apiKeys.userId, userId)));
  const row = rows[0];
  if (!row) return null;
  try {
    return decrypt(row.key);
  } catch (e) {
    console.error(`Failed to decrypt API key for provider "${provider}":`, e);
    return null;
  }
}

// ===== Obsidian Config =====

export interface ObsidianConfigEntry {
  vaultPath: string;
  updatedAt: number;
}

export async function getObsidianConfig(userId: string): Promise<ObsidianConfigEntry | null> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(obsidianConfig)
    .where(eq(obsidianConfig.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    vaultPath: row.vaultPath,
    updatedAt: row.updatedAt,
  };
}

export async function setObsidianConfig(userId: string, vaultPath: string): Promise<void> {
  await ready();
  const db = getDb();
  const now = Date.now();
  await db
    .insert(obsidianConfig)
    .values({
      userId,
      vaultPath,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: obsidianConfig.userId,
      set: { vaultPath, updatedAt: now },
    });
}

export async function deleteObsidianConfig(userId: string): Promise<void> {
  await ready();
  const db = getDb();
  await db.delete(obsidianConfig).where(eq(obsidianConfig.userId, userId));
}
