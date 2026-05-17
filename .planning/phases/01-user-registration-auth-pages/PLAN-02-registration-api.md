---
id: 01-user-registration-auth-pages-plan2
phase: 1
wave: 1
depends_on:
  - 01-user-registration-auth-pages-plan1
files_modified:
  - apps/web/package.json
  - apps/web/pnpm-lock.yaml (auto)
  - apps/web/lib/auth.ts (create)
  - apps/web/app/api/auth/register/route.ts (create)
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-07
---

## Objective

Create the registration API endpoint (`POST /api/auth/register`) with bcrypt password hashing, username validation, and uniqueness checking.

---

## Tasks

### Task 1: Install bcryptjs dependency

<read_first>
- `apps/web/package.json` — dependency list (add `bcryptjs` to `dependencies`, `@types/bcryptjs` to `devDependencies`)
</read_first>

<action>
1. Install bcryptjs (pure JS, no native compilation needed):

```bash
cd /path/to/agent-web
pnpm --filter web add bcryptjs
pnpm --filter web add -D @types/bcryptjs
```

2. Verify installation: check `apps/web/package.json` for `"bcryptjs"` in `dependencies` and `"@types/bcryptjs"` in `devDependencies`.
</action>

<acceptance_criteria>
- `apps/web/package.json` has `"bcryptjs": "^2.4.3"` (or similar) in `dependencies`
- `apps/web/package.json` has `"@types/bcryptjs": "^2.4.6"` (or similar) in `devDependencies`
- `pnpm install` succeeds
</acceptance_criteria>

---

### Task 2: Create `apps/web/lib/auth.ts` — shared server-only auth helpers

<read_first>
- `apps/web/lib/crypto.ts` — "server-only" import guard pattern
- `apps/web/lib/db.ts` — `eq` usage pattern, `getDb()` access via `@agent-web/db`
</read_first>

<action>
1. Create `apps/web/lib/auth.ts` with the following content:

```typescript
import "server-only";
import { getDb, users } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { User } from "@agent-web/db/schema";

const SALT_ROUNDS = 12;
const TOKEN_BYTES = 48;
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ===== Password helpers =====

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ===== User queries =====

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
  return rows[0];
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = { id, username: username.toLowerCase(), passwordHash, createdAt: now, updatedAt: now };
  await db.insert(users).values(row);
  return row;
}

// ===== Auth token helpers =====

export async function createAuthToken(userId: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const db = getDb();
  const now = Date.now();
  await db.insert(schemaTokens).values({
    token,
    userId,
    expiresAt: now + TOKEN_EXPIRY_MS,
    createdAt: now,
  });
  return token;
}

export async function verifyAuthToken(token: string): Promise<User | null> {
  const db = getDb();
  const rows = await db.select().from(schemaTokens).where(eq(schemaTokens.token, token));
  const row = rows[0];
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    await db.delete(schemaTokens).where(eq(schemaTokens.token, token));
    return null;
  }
  const userRows = await db.select().from(users).where(eq(users.id, row.userId));
  return userRows[0] ?? null;
}

export async function deleteAuthToken(token: string): Promise<void> {
  const db = getDb();
  await db.delete(schemaTokens).where(eq(schemaTokens.token, token));
}

// ===== Token table access (internal) =====

const schemaTokens = users._.table; // placeholder — handled in PLAN-04 where auth_tokens table is added
```

**Note:** The token table schema will be added in PLAN-04 (Login & Session Setup). The `createAuthToken`/`verifyAuthToken`/`deleteAuthToken` functions reference a `schemaTokens` Drizzle table that does not exist yet. These functions will be **finalized** in PLAN-04. For this plan, only implement `hashPassword`, `verifyPassword`, `getUserByUsername`, and `createUser`.

The correct version of `apps/web/lib/auth.ts` for this plan should **only** contain:

```typescript
import "server-only";
import { getDb, users } from "@agent-web/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { User } from "@agent-web/db/schema";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
  return rows[0];
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = { id, username: username.toLowerCase(), passwordHash, createdAt: now, updatedAt: now };
  await db.insert(users).values(row);
  return row;
}
```
</action>

<acceptance_criteria>
- `apps/web/lib/auth.ts` exists with `"server-only"` import guard
- Exports: `hashPassword`, `verifyPassword`, `getUserByUsername`, `createUser`
- All functions use `import { getDb, users } from "@agent-web/db"`
- Username is normalized to lowercase before DB operations
- Password hashing uses 12 salt rounds
</acceptance_criteria>

---

### Task 3: Create `apps/web/app/api/auth/register/route.ts`

<read_first>
- `apps/web/app/api/keys/route.ts` — API route pattern: Zod schema, `safeParse`, `try/catch`, `Response.json()`
- `apps/web/lib/auth.ts` — the auth helpers created in Task 2
</read_first>

<action>
1. Create directory structure:

```bash
mkdir -p apps/web/app/api/auth/register
```

2. Create `apps/web/app/api/auth/register/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { hashPassword, getUserByUsername, createUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    )
    .transform((s) => s.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = RegisterSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;

    // Check uniqueness
    const existing = await getUserByUsername(username);
    if (existing) {
      return Response.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(username, passwordHash);

    // Never return passwordHash
    return Response.json(
      {
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const err = e as Error;
    console.error("POST /api/auth/register error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/register/route.ts` exists
- Exports `POST` function with `runtime = "nodejs"` and `dynamic = "force-dynamic"`
- Zod schema validates: username length 3-32, regex `^[a-zA-Z0-9_-]+$`, lowercase transform; password length 8-128
- Returns 400 on validation failure with field errors
- Returns 409 on duplicate username
- Returns 201 with `{ user: { id, username, createdAt } }` on success
- Never returns `passwordHash` in the response
- Uses `try/catch` and logs with `console.error`
</acceptance_criteria>

---

## Verification Criteria

1. `pnpm --filter web add bcryptjs` and `pnpm --filter web add -D @types/bcryptjs` succeed
2. `apps/web/lib/auth.ts` exists with `hashPassword`, `verifyPassword`, `getUserByUsername`, `createUser`
3. `POST /api/auth/register` accepts valid username+password and returns 201 with user object
4. `POST /api/auth/register` with duplicate username returns 409
5. `POST /api/auth/register` with invalid username (too short, bad chars) returns 400
6. `POST /api/auth/register` with short password (< 8) returns 400
7. Password hash column in DB is a 60-char bcrypt string (not plaintext)

## Must Haves

- `bcryptjs` (pure JS) — no native compilation needed
- 12 salt rounds for password hashing
- Username normalized to lowercase before uniqueness check and insert
- Username regex: `^[a-zA-Z0-9_-]+$`
- Never return `passwordHash` in API responses
- API follows existing route pattern (Zod `safeParse`, `try/catch`, `Response.json`)
- Reserved usernames (`admin`, `root`, `system`, `null`, `undefined`, `api`, `login`, `register`) rejected at registration
