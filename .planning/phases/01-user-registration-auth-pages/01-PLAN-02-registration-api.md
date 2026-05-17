---
id: 01-user-registration-auth-pages-plan02
phase: 1
wave: 1
depends_on:
  - PLAN-01
files_modified:
  - apps/web/lib/auth.ts
  - apps/web/app/api/auth/register/route.ts
  - apps/web/package.json
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-07
---

# Plan 02: Registration API

## Objective

Create the server-side auth utility module and the POST /api/auth/register endpoint with bcrypt password hashing and username uniqueness enforcement.

## Tasks

### Task 2.1: Install bcryptjs dependency

<read_first>
- apps/web/package.json
- apps/web/next.config.ts (for serverExternalPackages)
</read_first>

<action>
1. Run: `pnpm --filter @agent-web/app add bcryptjs`
2. Run: `pnpm --filter @agent-web/app add -D @types/bcryptjs`
3. Verify bcryptjs appears in `apps/web/package.json` dependencies
4. If `next.config.ts` has a `serverExternalPackages` array, ensure bcryptjs is NOT listed there (it's pure JS, no native modules)
</action>

<acceptance_criteria>
- `apps/web/package.json` contains `"bcryptjs"` in dependencies
- `apps/web/package.json` contains `"@types/bcryptjs"` in devDependencies
- `pnpm install` completes without errors
</acceptance_criteria>

### Task 2.2: Create auth utility module

<read_first>
- apps/web/lib/crypto.ts (existing "server-only" module pattern)
- packages/db/src/schema.ts (for User type)
- apps/web/lib/db.ts (for DB access pattern using getDb())
</read_first>

<action>
Create `apps/web/lib/auth.ts` with "server-only" import:

```typescript
import "server-only";
import bcrypt from "bcryptjs";
import { getDb } from "@agent-web/db";
import { users } from "@agent-web/db";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(username: string, password: string) {
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
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return result[0] ?? null;
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 32) return "Username must be at most 32 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, underscores, and hyphens";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  return null;
}

// Reserved usernames
const RESERVED_USERNAMES = ["admin", "root", "system", "api", "login", "register", "auth"];

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}
```

Export all functions.
</action>

<acceptance_criteria>
- `apps/web/lib/auth.ts` exists with all exported functions
- `"server-only"` import is present at the top
- Functions use `import bcrypt from "bcryptjs"` (ESM default import)
- TypeScript compilation passes
</acceptance_criteria>

### Task 2.3: Create registration API route

<read_first>
- apps/web/app/api/keys/route.ts (existing API route pattern with Zod, try/catch, exports)
- apps/web/lib/auth.ts (just created above)
- packages/db/src/schema.ts (for users table)
</read_first>

<action>
Create `apps/web/app/api/auth/register/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createUser, findUserByUsername, validateUsername, validatePassword, isReservedUsername } from "@/lib/auth";
import { getDb } from "@agent-web/db";
import { users } from "@agent-web/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    
    if (isReservedUsername(username)) {
      return NextResponse.json({ error: "This username is reserved" }, { status: 400 });
    }
    
    // Check uniqueness
    const existing = await findUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }
    
    const user = await createUser(username, password);
    
    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/register/route.ts` exists with POST handler
- POST with valid username/password returns 201 with user object
- POST with duplicate username returns 409
- POST with invalid username (too short, bad chars) returns 400
- POST with missing fields returns 400
- Password is bcrypt-hashed in the database (verify by checking hash != plaintext)
</acceptance_criteria>

## Verification Criteria

1. Start the dev server: `pnpm dev`
2. `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"testuser","password":"password123"}'` returns 201
3. Same request again returns 409
4. `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"ab","password":"password123"}'` returns 400
5. DB contains a user with hashed password (not plaintext)

## must_haves

- Passwords are hashed with bcrypt (12 rounds) before storage
- Duplicate usernames are rejected with 409
- Username validation rejects invalid characters and short names
