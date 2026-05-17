---
id: 01-user-registration-auth-pages-plan04
phase: 1
wave: 2
depends_on:
  - PLAN-01
  - PLAN-02
files_modified:
  - apps/web/lib/auth.ts
  - apps/web/app/api/auth/login/route.ts
  - apps/web/app/login/page.tsx
autonomous: true
requirements:
  - AUTH-03
  - AUTH-04
  - DB-03
---

# Plan 04: Login Page & Session Setup

## Objective

Create the login page UI and POST /api/auth/login endpoint with cookie-based token session management.

## Tasks

### Task 4.1: Add session functions to auth module

<read_first>
- apps/web/lib/auth.ts (existing — will be extended)
- packages/db/src/schema.ts (for auth_tokens table)
- packages/core/src/types.ts (for type patterns, if needed)
</read_first>

<action>
Add these functions to `apps/web/lib/auth.ts`:

```typescript
import { authTokens } from "@agent-web/db";
import { eq, and, gt } from "drizzle-orm";

const TOKEN_LENGTH = 96; // hex chars = 48 bytes
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function createSession(userId: string): Promise<string> {
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
```

Export all new functions.
</action>

<acceptance_criteria>
- `apps/web/lib/auth.ts` exports `createSession`, `validateSession`, `deleteSession`
- Token is a 96-char hex string
- Session expires after 7 days
- TypeScript compilation passes
</acceptance_criteria>

### Task 4.2: Create login API route

<read_first>
- apps/web/app/api/auth/register/route.ts (sibling route for pattern reference)
- apps/web/lib/auth.ts (for findUserByUsername, verifyPassword, createSession)
</read_first>

<action>
Create `apps/web/app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByUsername, verifyPassword, createSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    
    const user = await findUserByUsername(username);
    if (!user) {
      // Generic error to prevent username enumeration
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }
    
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }
    
    const token = await createSession(user.id);
    
    const response = NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 200 }
    );
    
    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });
    
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/login/route.ts` exists with POST handler
- Valid credentials return 200 with user object and Set-Cookie header
- Invalid username returns 401 "Invalid username or password"
- Invalid password returns 401 "Invalid username or password" (same message)
- Missing fields return 400
- Set-Cookie has httpOnly, sameSite=lax, path=/, maxAge=604800
</acceptance_criteria>

### Task 4.3: Create login page

<read_first>
- apps/web/app/register/page.tsx (sibling page pattern)
</read_first>

<action>
Create `apps/web/app/login/page.tsx`:

1. `"use client"` directive
2. Centered form matching the register page design
3. Username input, password input, submit button with loading state
4. Error message display (generic for invalid credentials)
5. On success, redirect to `/` (main chat page)
6. Link to /register: "Don't have an account? Register"
7. Dark theme consistent with register page

```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Render centered card: Login form
  // Two fields + submit button
  // Link to register page
  // Error display "Invalid username or password"
}
```
</action>

<acceptance_criteria>
- `apps/web/app/login/page.tsx` exists with "use client" directive
- Page renders at `/login` with centered form matching dark theme
- Valid login redirects to `/` (main page)
- Invalid credentials show error
- Link to /register is present
</acceptance_criteria>

## Verification Criteria

1. Navigate to `/login` — form displayed with dark theme
2. Login with valid credentials — redirects to `/` with session cookie set
3. Login with invalid credentials — error "Invalid username or password"
4. Cookie `session_token` is set with httpOnly flag
5. Logging in as another user works correctly

## must_haves

- Login returns httpOnly session cookie
- Error message does NOT reveal whether username exists
- Session lasts 7 days
