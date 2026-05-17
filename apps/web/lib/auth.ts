import "server-only";
import bcrypt from "bcryptjs";
import { getDb, ensureMigrated } from "@agent-web/db";
import { users, authTokens } from "@agent-web/db";
import { eq, and, gt } from "drizzle-orm";

const SALT_ROUNDS = 12;
const TOKEN_LENGTH = 96;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

let migrationPromise: Promise<void> | null = null;

async function ensureDb() {
  if (!migrationPromise) {
    migrationPromise = ensureMigrated();
  }
  await migrationPromise;
}

// ===== Password Hashing =====

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ===== User CRUD =====

export async function createUser(username: string, password: string) {
  await ensureDb();
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    username: username.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return { id, username: username.toLowerCase() };
}

export async function findUserByUsername(username: string) {
  await ensureDb();
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return result[0] ?? null;
}

// ===== Validation =====

export function validateUsername(username: string): string | null {
  if (typeof username !== "string" || username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 32) return "Username must be at most 32 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, underscores, and hyphens";
  return null;
}

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 6) return "Password must be at least 6 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  return null;
}

const RESERVED_USERNAMES = ["admin", "root", "system", "api", "login", "register", "auth"];

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}

// ===== Request Auth Helper =====

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  if (!match) return null;
  return validateSession(match[1]);
}

// ===== Session Management =====

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function createSession(userId: string): Promise<string> {
  await ensureDb();
  const db = getDb();
  const token = generateToken();
  const now = Date.now();

  await db.insert(authTokens).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt: now + SESSION_DURATION_MS,
    createdAt: now,
  });

  return token;
}

export async function validateSession(token: string): Promise<string | null> {
  await ensureDb();
  const db = getDb();
  const result = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        gt(authTokens.expiresAt, Date.now())
      )
    )
    .limit(1);

  return result[0]?.userId ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(authTokens).where(eq(authTokens.token, token));
}

// ===== Profile Management =====

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const db = getDb();
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: Date.now() }).where(eq(users.id, userId));
}

export async function listAllUsers(): Promise<{ id: string; username: string; createdAt: number }[]> {
  const db = getDb();
  const rows = await db.select({ id: users.id, username: users.username, createdAt: users.createdAt }).from(users).orderBy(users.createdAt);
  return rows;
}
