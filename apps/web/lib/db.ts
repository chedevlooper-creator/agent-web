import "server-only";
import { getDb, projects, sessions, messages, ensureMigrated } from "@agent-web/db";
import { eq, desc, asc, isNull } from "drizzle-orm";
import type { Role } from "@agent-web/core";

export type { Role };

export interface DbProject {
  id: string;
  name: string;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
}

export interface DbMessage {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  model: string | null;
  timestamp: number;
}

export interface DbSession {
  id: string;
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

// ===== Projects =====

export async function listProjects(): Promise<DbProject[]> {
  await ready();
  const db = getDb();
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));
  return rows;
}

export async function createProject(input: {
  id: string;
  name: string;
  rootPath: string;
}): Promise<DbProject> {
  await ready();
  const db = getDb();
  const now = Date.now();
  const row = { id: input.id, name: input.name, rootPath: input.rootPath, createdAt: now, updatedAt: now };
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

export async function listSessions(projectId?: string): Promise<DbSession[]> {
  await ready();
  const db = getDb();
  const where = projectId ? eq(sessions.projectId, projectId) : isNull(sessions.projectId);
  const rows = await db
    .select()
    .from(sessions)
    .where(where)
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function listSessionsWithMessages(): Promise<DbSessionWithMessages[]> {
  await ready();
  const db = getDb();
  const sessionsRows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.updatedAt));
  const result: DbSessionWithMessages[] = [];
  for (const s of sessionsRows) {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, s.id))
      .orderBy(asc(messages.timestamp));
    result.push({
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messages: msgs.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as Role,
        content: m.content,
        model: m.model,
        timestamp: m.timestamp,
      })),
    });
  }
  return result;
}

export async function getSession(id: string): Promise<DbSession | null> {
  await ready();
  const db = getDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSession(input: {
  id: string;
  projectId?: string | null;
  title?: string;
}): Promise<DbSession> {
  await ready();
  const db = getDb();
  const now = Date.now();
  const row = {
    id: input.id,
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
    role: m.role as Role,
    content: m.content,
    model: m.model,
    timestamp: m.timestamp,
  }));
}

export async function addMessage(input: {
  id: string;
  sessionId: string;
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
  const all = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  const toDelete = all.filter((m) =>
    inclusive ? m.timestamp >= afterTimestamp : m.timestamp > afterTimestamp
  );
  for (const m of toDelete) {
    await db.delete(messages).where(eq(messages.id, m.id));
  }
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
  for (const s of payload) {
    const exists = await db.select().from(sessions).where(eq(sessions.id, s.id));
    if (exists.length === 0) {
      await db.insert(sessions).values({
        id: s.id,
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
    for (const m of s.messages) {
      const exists = await db.select().from(messages).where(eq(messages.id, m.id));
      if (exists.length === 0) {
        await db.insert(messages).values({
          id: m.id,
          sessionId: s.id,
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
