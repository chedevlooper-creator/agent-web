---
id: 01-user-registration-auth-pages-plan4
phase: 1
wave: 2
depends_on:
  - 01-user-registration-auth-pages-plan1
  - 01-user-registration-auth-pages-plan2
files_modified:
  - packages/db/src/schema.ts
  - packages/db/src/migrate.ts
  - apps/web/lib/auth.ts
  - apps/web/app/api/auth/login/route.ts (create)
  - apps/web/app/login/page.tsx (create)
  - apps/web/components/auth/login-form.tsx (create)
autonomous: true
requirements:
  - AUTH-03
  - AUTH-04
  - DB-03
---

## Objective

Create the login page, login API with session token generation, and the auth token persistence layer (DB-backed sessions).

---

## Tasks

### Task 1: Add `auth_tokens` table to schema + migration

<read_first>
- `packages/db/src/schema.ts` — existing pattern for adding new tables
- `packages/db/src/migrate.ts` — existing migration pattern
</read_first>

<action>
1. In `packages/db/src/schema.ts`, add the `auth_tokens` table **after `users`**:

```typescript
export const authTokens = sqliteTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

2. Add type exports:

```typescript
export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;
```

3. In `packages/db/src/migrate.ts`, add migration SQL:

```typescript
const CREATE_AUTH_TOKENS = `
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

const CREATE_INDEX_AUTH_TOKENS_USER = `
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
`;
```

4. In `runMigrations()`, execute after `CREATE_INDEX_USERS_USERNAME`:

```typescript
await client.execute(CREATE_AUTH_TOKENS);
await client.execute(CREATE_INDEX_AUTH_TOKENS_USER);
```

5. Build the DB package:

```bash
pnpm --filter @agent-web/db build
```
</action>

<acceptance_criteria>
- `auth_tokens` table in schema with `token` (PK), `userId` (FK→users, cascade delete), `expiresAt`, `createdAt`
- `AuthToken`/`NewAuthToken` types exported
- Migration SQL with `IF NOT EXISTS` + index on `user_id`
- Build succeeds
</acceptance_criteria>

---

### Task 2: Add auth token functions to `apps/web/lib/auth.ts`

<read_first>
- `apps/web/lib/auth.ts` — existing auth helpers (add to this file)
- `packages/db/src/schema.ts` — `authTokens` table import
</read_first>

<action>
1. Extend `apps/web/lib/auth.ts` to add token management. The final file should contain:

```typescript
import "server-only";
import { getDb, users, authTokens } from "@agent-web/db";
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

export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id));
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
  await db.insert(authTokens).values({
    token,
    userId,
    expiresAt: now + TOKEN_EXPIRY_MS,
    createdAt: now,
  });
  return token;
}

export async function verifyAuthToken(token: string): Promise<User | null> {
  const db = getDb();
  const rows = await db.select().from(authTokens).where(eq(authTokens.token, token));
  const row = rows[0];
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    // Clean up expired token
    await db.delete(authTokens).where(eq(authTokens.token, token));
    return null;
  }
  const userRows = await db.select().from(users).where(eq(users.id, row.userId));
  return userRows[0] ?? null;
}

export async function deleteAuthToken(token: string): Promise<void> {
  const db = getDb();
  await db.delete(authTokens).where(eq(authTokens.token, token));
}
```
</action>

<acceptance_criteria>
- `createAuthToken(userId)` generates a 96-char hex token (48 bytes), inserts into `auth_tokens` with 7-day expiry
- `verifyAuthToken(token)` looks up token, checks expiry, returns `User` or `null`
- Expired tokens are deleted on lookup
- `deleteAuthToken(token)` removes a token
- `getUserById(id)` returns user by ID
- All functions use `"server-only"` guard
</acceptance_criteria>

---

### Task 3: Create `apps/web/app/api/auth/login/route.ts`

<read_first>
- `apps/web/app/api/auth/register/route.ts` — reference for API route pattern
- `apps/web/lib/auth.ts` — `verifyPassword`, `getUserByUsername`, `createAuthToken`
</read_first>

<action>
1. Create directory:

```bash
mkdir -p apps/web/app/api/auth/login
```

2. Create `apps/web/app/api/auth/login/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyPassword, getUserByUsername, createAuthToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = LoginSchema.safeParse(raw);
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

    // Look up user
    const user = await getUserByUsername(username);
    if (!user) {
      // Generic "Invalid credentials" to prevent username enumeration
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create session token
    const token = await createAuthToken(user.id);

    // Set cookie and return success
    const response = Response.json({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    });

    response.headers.set(
      "Set-Cookie",
      `auth-token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}; ${
        process.env.NODE_ENV === "production" ? "Secure; " : ""
      }`
    );

    return response;
  } catch (e: unknown) {
    const err = e as Error;
    console.error("POST /api/auth/login error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/login/route.ts` exists with `POST` handler
- Zod validates username (min 1, lowercase transform) and password (min 1)
- Returns 401 with `"Invalid credentials"` for wrong username OR wrong password (generic, no enumeration)
- On success: creates auth token, sets `auth-token` cookie (HttpOnly, SameSite=Lax, Path=/, 7-day Max-Age)
- Secure flag only in production
- Returns `{ user: { id, username, createdAt } }` on success
</acceptance_criteria>

---

### Task 4: Create login page and form

<read_first>
- `apps/web/app/register/page.tsx` — page pattern
- `apps/web/components/auth/register-form.tsx` — form pattern (reuse same styling approach)
</read_first>

<action>
1. Create `apps/web/app/login/page.tsx`:

```typescript
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="brand-wordmark text-2xl mb-1">
            Agent<span>Web</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </div>
        <LoginForm />
        <p className="text-center mt-6 text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="text-electric hover:text-electric-hover underline underline-offset-2 transition-colors"
          >
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}
```

2. Create `apps/web/components/auth/login-form.tsx`:

```typescript
"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2, LogIn, AlertCircle, Eye, EyeOff, User, Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!username.trim() || !password) {
        setError("Please enter your username and password.");
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid credentials");
          return;
        }

        // Success — redirect to main app (cookie is set server-side)
        router.push("/");
        router.refresh();
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setSubmitting(false);
      }
    },
    [username, password, router]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-6 space-y-5 animate-scale-in"
      noValidate
    >
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive-muted border border-destructive/20 text-destructive text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Username */}
      <div className="space-y-1.5">
        <label htmlFor="login-username" className="section-label">
          Username
        </label>
        <div className="relative">
          <User
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            placeholder="Your username"
            autoComplete="username"
            autoFocus
            className={cn(
              "min-h-[44px] w-full pl-10 pr-3 rounded-xl text-sm",
              "bg-surface-muted border border-border-muted",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "transition-[border-color,box-shadow,background-color] duration-200"
            )}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="login-password" className="section-label">
          Password
        </label>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Your password"
            autoComplete="current-password"
            className={cn(
              "min-h-[44px] w-full pl-10 pr-12 rounded-xl text-sm",
              "bg-surface-muted border border-border-muted",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "transition-[border-color,box-shadow,background-color] duration-200"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "min-h-[44px] w-full flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-medium",
          "transition-[opacity,transform,background-color] duration-200",
          "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          submitting
            ? "bg-primary/60 text-black cursor-not-allowed"
            : "bg-primary text-black hover:opacity-90"
        )}
      >
        {submitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Signing in&hellip;
          </>
        ) : (
          <>
            <LogIn size={15} />
            Sign In
          </>
        )}
      </button>
    </form>
  );
}
```
</action>

<acceptance_criteria>
- `apps/web/app/login/page.tsx` exists as server component with brand wordmark and sign-in prompt
- `apps/web/components/auth/login-form.tsx` exists with `"use client"` directive
- Form has username, password (with show/hide toggle), and submit button
- Empty fields show "Please enter your username and password" error
- On invalid credentials → shows "Invalid credentials" error
- On success → `router.push("/")` + `router.refresh()` (cookie set server-side in Set-Cookie header)
- Loading/disabled state on submit button
- Dark theme matching register form (glass-card, electric accents)
- "Don't have an account? Create one" link to `/register`
</acceptance_criteria>

---

## Verification Criteria

1. `auth_tokens` table exists in DB schema with `token` PK, `userId` FK, `expiresAt`, `createdAt`
2. `pnpm --filter @agent-web/db build` succeeds
3. `POST /api/auth/login` with valid credentials returns 200 with user object and `Set-Cookie` header
4. `POST /api/auth/login` with wrong password returns 401 "Invalid credentials"
5. `POST /api/auth/login` with non-existent user returns 401 "Invalid credentials" (same message)
6. Cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, 7-day `Max-Age`
7. `/login` page renders with form and register link
8. Successful login redirects to `/`
9. Expired tokens are cleaned up and rejected

## Must Haves

- Generic "Invalid credentials" for both wrong username and wrong password (prevents enumeration)
- DB-backed session tokens (not JWT, not signed cookies)
- 7-day token expiry
- HttpOnly + SameSite=Lax cookie
- Cookie set via `Set-Cookie` header (not client-side)
- Cascade delete token when user is removed
- Index on `auth_tokens.user_id` for efficient lookups
