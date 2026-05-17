# Phase 1 Research: User Registration & Auth Pages

**Date:** 2026-05-17
**Phase:** 01 — User Registration & Auth Pages
**Requirements:** AUTH-01, AUTH-02, AUTH-07, DB-01

---

## 1. Introduction & Phase Goal

Deliver a minimal **username-based registration system** (no email required) with secure password storage. Users create an account with a unique username and a bcrypt-hashed password, stored in a `users` SQLite table. This is a **local-first, single-user-tool** type auth — no OAuth, no email verification, no password reset is required yet.

The project is an AI developer command center (Next.js 16, React 19, SQLite via Drizzle ORM). Auth is meant to gate the chat interface behind a login wall, not to be a full identity provider.

---

## 2. Technical Approach

### 2.1 Database: `users` Table

**File to modify:** `packages/db/src/schema.ts`

Follow the existing Drizzle pattern exactly:

```6:10:packages/db/src/schema.ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rootPath: text("root_path").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

**Locked recommendation for `users` table:**

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),                    // crypto.randomUUID() or cuid2
  username: text("username").notNull().unique(),   // UNIQUE constraint for AUTH-07
  passwordHash: text("password_hash").notNull(),   // bcrypt hash (60 chars)
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

Add the TypeScript types below the table:

```typescript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Key decisions:**
- Use `text("id").primaryKey()` — matches existing convention (UUID-based, not auto-increment).
- `.unique()` on `username` — this is the Drizzle way to enforce AUTH-07 uniqueness. SQLite enforces this at the DB level.
- `integer("created_at")` — stores `Date.now()` (epoch ms), matching all 4 existing tables.
- No email column — per AUTH-01, only username + password.

### 2.2 Migration: `CREATE TABLE users`

**File to modify:** `packages/db/src/migrate.ts`

The migration system uses **raw SQL**, not Drizzle Kit. Add to `runMigrations()`:

```typescript
const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

// Inside runMigrations(), after existing tables:
await client.execute(CREATE_USERS);
```

Add a unique index for username lookups (username is the primary lookup field):

```typescript
const CREATE_INDEX_USERS_USERNAME = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
`;
```

Note: The UNIQUE constraint on the column already creates an index, but an explicit named index is good practice for documentation and migration clarity.

### 2.3 Bcrypt: Package Choice & Import Pattern

**Package:** `bcryptjs` (pure JavaScript, no native compilation)

**Rationale:**
- `bcrypt` (native) requires node-gyp / build-essentials, which can fail in Docker and on Windows without build tools.
- `bcryptjs` is pure JS, works everywhere, and is ~2x slower per hash (still fine for registration — we're not doing real-time auth at scale).
- The project's Dockerfile uses `node:22-slim` and installs `python3 make g++` for native deps, but avoiding native deps is simpler.

**Install:**

```bash
pnpm --filter web add bcryptjs
pnpm --filter web add -D @types/bcryptjs
```

**Import pattern:**

```typescript
import bcrypt from "bcryptjs";

// Hash (registration)
const salt = await bcrypt.genSalt(12);  // 12 rounds — good balance of security & speed
const passwordHash = await bcrypt.hash(password, salt);

// Verify (login)
const match = await bcrypt.compare(password, storedHash);
```

**Salt rounds:** 12 (not 10). This is the cost factor. 12 rounds (~250ms on modern hardware) is the recommended minimum for user-facing auth in 2026. Lower rounds for tests if needed.

### 2.4 API Route: POST /api/auth/register and /api/auth/login

**File to create:** `apps/web/app/api/auth/register/route.ts`
**File to create:** `apps/web/app/api/auth/login/route.ts`

Follow the API route pattern from `apps/web/app/api/keys/route.ts`:

```1:44:apps/web/app/api/keys/route.ts
import { NextRequest } from "next/server";
// ... imports ...
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Schema validation with Zod
function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request", ... }, { status: 400 });
    }
    // ... business logic ...
    return Response.json({ ... });
  } catch (e) { ... }
}
```

#### POST /api/auth/register

**Zod schema:**

```typescript
const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
    .transform((s) => s.toLowerCase()), // case-insensitive normalization
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});
```

**Flow:**
1. Validate with Zod (trim whitespace, check length, allowed chars)
2. Transform username to lowercase for case-insensitive uniqueness
3. Check if username already exists with `db.select().from(users).where(eq(users.username, username))`
4. If exists → return 409 Conflict
5. Hash password with `bcryptjs` (12 salt rounds)
6. Insert user with `crypto.randomUUID()` for ID
7. Return 201 with `{ user: { id, username, createdAt } }` (never return passwordHash)

#### POST /api/auth/login

**Zod schema:** Same as register but password min 1.

**Flow:**
1. Validate input
2. Normalize username to lowercase
3. Look up user by username
4. If not found → return 401 (generic "Invalid credentials")
5. Compare password with `bcrypt.compare()`
6. If mismatch → return 401
7. On success → create a session (either JWT or a simple session token stored in DB)

#### Session Strategy

**Locked recommendation:** Use a simple **session token** stored in the `sessions` table or a dedicated `auth_tokens` table.

- Generate a random token with `crypto.randomBytes(48).toString("hex")`
- Store it in a cookie (`httpOnly`, `secure`, `sameSite: "lax"`)
- Token validity: 7 days (extend on each request)
- Store: a new `auth_tokens` table or repurpose existing session concept

**Simpler alternative (not recommended for real security but pragmatic):** Store userId in a signed cookie using a server secret. The existing `ENCRYPTION_KEY` could be reused for signing. However, a database-backed token table is the more correct pattern.

**For the scope of this phase:** A minimal `auth_token` approach fits best — a new small table with `token, userId, expiresAt, createdAt` or simply store the token alongside user info.

### 2.5 Registration Page UI

**File to create:** `apps/web/app/register/page.tsx`
**File to create:** `apps/web/app/login/page.tsx`

This is a **server component** that renders a client component for the form:

```typescript
// apps/web/app/register/page.tsx
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return <RegisterForm />;
}
```

The form component (`apps/web/components/auth/register-form.tsx`) should be a "use client" component that:
- Renders two fields: username, password
- Client-side validation (show errors inline)
- POSTs to `/api/auth/register`
- On success, redirects to `/` (or auto-login and redirect)
- Loading state on submit button
- Error display (username taken, validation errors, server error)

**File to create:** `apps/web/components/auth/register-form.tsx`

Password input should have:
- `type="password"`
- Minimum length indicator
- Show/hide toggle (optional but good UX)

#### Middleware for Auth Guard

**File to create:** `apps/web/middleware.ts`

To protect the main app behind auth:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const { pathname } = request.nextUrl;

  // Allow auth pages and static assets
  if (pathname.startsWith("/login") || pathname.startsWith("/register") ||
      pathname.startsWith("/api/auth") || pathname.startsWith("/_next") ||
      pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
```

### 2.6 Auth Token Verification Helper

**File to create:** `apps/web/lib/auth.ts`

Pattern: server-only module with `"server-only"` import guard, matching `lib/db.ts`.

```typescript
import "server-only";
// functions for:
// - createAuthToken(userId: string): Promise<string>
// - verifyAuthToken(token: string): Promise<User | null>
// - deleteAuthToken(token: string): Promise<void>
```

---

## 3. Implementation Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bcrypt package | `bcryptjs` (pure JS) | No native compilation; works in Docker/Windows without build tools |
| Salt rounds | 12 | Standard in 2026; ~250ms per hash |
| Username case handling | Store normalized lowercase | Prevent `User` vs `user` ambiguity; `.unique()` index enforces at DB level |
| User ID format | `crypto.randomUUID()` | Matches existing UUID pattern for all other tables |
| Session mechanism | DB-stored auth token with httpOnly cookie | Simple, no JWT library needed; token revocable; reuses existing DB pattern |
| Auth guard | Next.js Middleware | Zero-dependency; runs at edge; clean separation |
| Password field rules | Min 8, max 128 chars | OWASP guidelines for password length |
| Username field rules | Min 3, max 32, alphanumeric `[a-zA-Z0-9_-]` | Common safe subset; prevents injection/display issues |
| Error messages (login) | Generic "Invalid credentials" | Prevents username enumeration |
| API response format | JSON with `{ error: "message" }` or `{ user: {...} }` | Matches all existing API routes |

---

## 4. Edge Cases & Gotchas

### Username Validation
- **Case sensitivity:** "Alice" and "alice" should be the same user. Solution: normalize `.toLowerCase()` before insert and before lookup.
- **Whitespace:** Trim both ends. Reject internal whitespace (regex `^[a-zA-Z0-9_-]+$` rejects spaces).
- **Unicode normalization:** Consider `username.normalize("NFC")` to handle diacritics consistently. E.g., `"café"` can be encoded two different ways in Unicode.
- **Reserved usernames:** Block `admin`, `root`, `system`, `null`, `undefined`, `api`, `login`, `register` to prevent confusion/abuse.
- **Length limits:** 3–32 chars enforced at DB level (`TEXT` with app-level validation). SQLite TEXT can hold very long data; Zod validation is the gatekeeper.
- **Special characters:** Only `[a-zA-Z0-9_-]`. Reject `@`, `.`, spaces, emoji, etc. This avoids display issues, URL encoding issues, and potential injection in system commands.

### Password Handling
- **Never log passwords.** Ensure `console.error` calls in the registration route exclude the password field.
- **Password strength:** Only enforce minimum length (8). No complexity requirements (OWASP 2024 guidelines removed complexity rules).
- **Timing:** bcrypt comparison is constant-time, no need for additional timing-safe comparison.

### Migration Order
- If the database already exists (from prior development), the `CREATE TABLE IF NOT EXISTS` ensures safe re-runs.
- Existing data is preserved.
- The migration system runs on every server start via `ensureMigrated()` in `lib/db.ts`. This is fine because it uses `IF NOT EXISTS`.

### Session Token
- **Token expiry:** Set expiry at creation time. Check on each request. Clean up expired tokens periodically or on login.
- **Cookie security:** `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production (omit secure for localhost dev).
- **No CSRF needed** for a first-party SPA with `sameSite: "lax"`. Add CSRF token later if cross-origin requests are needed.
- **Token rotation:** On password change, invalidate all existing tokens.

### Redirect Loop Protection
- If middleware redirects `/login` -> `/login` when no token, ensure login/register paths are excluded from the auth guard.
- After successful login, redirect to `/` with the token cookie set.

---

## 5. Key Code Patterns to Follow

### 5.1 Drizzle Schema Pattern

```6:10:packages/db/src/schema.ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ...
});
```

New tables follow the same `sqliteTable()` call, explicit column names with snake_case, and TypeScript `$inferSelect`/`$inferInsert` types.

### 5.2 Migration Pattern

```59:76:packages/db/src/migrate.ts
export async function runMigrations(url?: string, authToken?: string) {
  const client = createClient({ ... });
  await client.execute(CREATE_TABLE_1);
  await client.execute(CREATE_TABLE_2);
  // ...
}
```

Each new migration is a raw SQL string followed by `await client.execute(...)`. The module-level `migrated` boolean ensures one-time execution.

### 5.3 API Route Pattern

```1:95:apps/web/app/api/keys/route.ts
- Named export: export async function POST(req: NextRequest)
- Zod schema at top of file (PascalCase + Schema suffix)
- safeParse pattern for validation
- try/catch wrapping all logic
- console.error for logging
- Returns Response.json() with { error } on failure, status codes
- Export runtime = "nodejs"
- Export dynamic = "force-dynamic"
```

### 5.4 Server-Only DB Access Layer Pattern

```1:5:apps/web/lib/db.ts
import "server-only";
import { getDb, users } from "@agent-web/db";
```

New auth functions go in a separate `lib/auth.ts` (leaf module) to keep concerns separated, following the existing convention where `lib/db.ts` handles domain data and `lib/crypto.ts` handles encryption.

### 5.5 Component Pattern

```1:1:apps/web/page.tsx
"use client";
// Named exports for components
// Zustand store for state
// Tailwind + CSS variables for styling
```

New auth forms follow the same pattern: `"use client"`, named export, Tailwind styling using the existing design tokens.

### 5.6 Route Group Pattern

The existing app has all pages at the root (`app/page.tsx`). Auth pages should be at:
- `app/register/page.tsx`
- `app/login/page.tsx`

These are regular App Router pages. Use a React 19 `useActionState` (formerly `useFormState`) or simple `useState` + `fetch` for form submission.

---

## 6. Security Considerations

### Password Storage (AUTH-02)
- **bcryptjs with 12 salt rounds** — sufficient for user-facing auth in a local-first developer tool.
- Never store plaintext passwords.
- Never log password values.

### Username Uniqueness (AUTH-07)
- **DB-level UNIQUE constraint** — the definitive guard against race conditions.
- **Application-level check before insert** — provides a clean error message.
- **Normalized to lowercase** — prevents case-conflict duplicates.

### Enumeration Prevention
- Login endpoint returns **generic "Invalid credentials"** regardless of whether the username exists or the password is wrong.
- Registration endpoint distinguishes "username taken" (409) from other errors — acceptable since the username is public info in a tool context.

### Session Security
- `httpOnly` cookie — not accessible via JavaScript (prevents XSS token theft).
- `sameSite: "lax"` — prevents CSRF from external sites.
- Token stored in DB — allows server-side revocation.
- Expiry — 7 days, extend on activity.

### Input Validation
- Zod validation on all API inputs — prevents malformed data at the boundary.
- Username regex restricts to safe characters — prevents injection into system commands, logs, or HTML.
- Password max length — prevents very long inputs from causing bcrypt DoS.

### Rate Limiting (Future Consideration)
- No rate limiting in the current codebase.
- The existing `lib/rate-limit.ts` file exists (mentioned in STRUCTURE.md) but wasn't found. Check if it exists.
- Add at least in-memory rate limiting to auth endpoints: 5 attempts per IP per minute.

### Encryption
- The project already has AES-256-GCM encryption (`lib/crypto.ts`) for API keys. Not needed for passwords (bcrypt is one-way).
- The `ENCRYPTION_KEY` env var exists — could be reused for signing auth cookies if the cookie-based approach is preferred over DB tokens.

### Docker Build
- The `Dockerfile` installs `python3 make g++` for native modules — but with `bcryptjs`, these are unnecessary for auth.
- No additional build dependencies required for auth.
- `@libsql/client` is already a `serverExternalPackage` in `next.config.ts`, ensuring it's not bundled client-side.

---

## 7. Recommended Verification Approach

### Unit Tests
1. **Username validation tests** — test allowed characters, length boundaries, normalization, whitespace trimming.
2. **Password hashing** — test that hash produces a 60-char string, that comparison works, that different passwords don't match.
3. **Schema types** — verify TypeScript compilation with new `User` and `NewUser` types.
4. **API route error cases** — duplicate username, missing fields, invalid username format, too-long password.

### Integration Tests
1. **POST /api/auth/register happy path** — register → 201 with user object (no passwordHash).
2. **POST /api/auth/register duplicate** — register same username twice → 409.
3. **POST /api/auth/login happy path** — register then login → 200 with token cookie.
4. **POST /api/auth/login wrong password** → 401.
5. **POST /api/auth/login non-existent user** → 401.
6. **Middleware redirect** — unauthenticated request to `/` → redirect to `/login`.

### Manual Testing
1. Navigate to `/register` — form renders, fields accept input.
2. Submit with valid data — redirects to `/login` or auto-logs in.
3. Submit with existing username — shows error message.
4. Submit with invalid characters — shows validation error.
5. Navigate to `/` without logging in — redirected to `/login`.
6. Login with correct credentials — redirected to `/`, can use the app.
7. Close tab, reopen — still logged in (cookie persists).

### Test Location
- New test files: `apps/web/app/api/auth/__tests__/register.test.ts` and `apps/web/app/api/auth/__tests__/login.test.ts`
- Component tests: `apps/web/components/auth/__tests__/register-form.test.tsx`
- Use existing Vitest setup with happy-dom (see `vitest.config.ts` and `vitest.setup.ts`).

---

## Files to Create/Modify

### Create
| File | Purpose |
|------|---------|
| `packages/db/src/schema.ts` (modify) | Add `users` table definition |
| `packages/db/src/migrate.ts` (modify) | Add `CREATE TABLE users` migration |
| `apps/web/lib/auth.ts` | Auth helper functions (create token, verify token) |
| `apps/web/app/api/auth/register/route.ts` | Registration API endpoint |
| `apps/web/app/api/auth/login/route.ts` | Login API endpoint |
| `apps/web/app/register/page.tsx` | Registration page |
| `apps/web/app/login/page.tsx` | Login page |
| `apps/web/components/auth/register-form.tsx` | Registration form component |
| `apps/web/components/auth/login-form.tsx` | Login form component |
| `apps/web/middleware.ts` | Auth guard middleware |

### Modify
| File | Change |
|------|--------|
| `packages/db/src/schema.ts` | Add `users` table, `User`/`NewUser` types |
| `packages/db/src/migrate.ts` | Add `CREATE_USERS` SQL + index |

### Install Dependencies
- `bcryptjs` (production) to `apps/web`
- `@types/bcryptjs` (dev) to `apps/web`

---

## RESEARCH COMPLETE
