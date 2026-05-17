---
id: 01-user-registration-auth-pages-plan5
phase: 1
wave: 2
depends_on:
  - 01-user-registration-auth-pages-plan4
files_modified:
  - apps/web/middleware.ts (create)
  - apps/web/lib/auth.ts
  - apps/web/next.config.ts
autonomous: true
requirements:
  - AUTH-05
  - AUTH-06
  - UI-04
---

## Objective

Create Next.js middleware to protect all routes except auth pages, redirect unauthenticated users to `/login`, and handle session expiry.

---

## Tasks

### Task 1: Add `getUserFromRequest` helper to `apps/web/lib/auth.ts`

<read_first>
- `apps/web/lib/auth.ts` — add a middleware-compatible helper
- `apps/web/middleware.ts` — will need to read cookie and verify token
</read_first>

<action>
1. Add the following functions to `apps/web/lib/auth.ts`. Note: Next.js Edge Middleware cannot use server-only Node.js modules (`bcryptjs`, `crypto`, `getDb()`). Token verification in middleware must be handled differently. There are two approaches:

**Approach A (Recommended): Edge-compatible token check in middleware**
- Middleware reads cookie and calls a lightweight API route to verify
- OR: Middleware only checks cookie existence, actual verification happens in API routes

**Approach B (Simpler for MVP): Middleware checks cookie presence + API route verifies**
- Middleware redirects if no cookie exists
- API routes call `verifyAuthToken()` for actual verification

**Locked recommendation: Approach B for Phase 1 scope**
- Middleware checks only cookie presence
- API routes (when protected in Phase 3) use `verifyAuthToken()` from `lib/auth.ts`
- This keeps middleware simple and avoids Edge runtime compatibility issues

No changes needed to `lib/auth.ts` for this plan — `verifyAuthToken`, `getUserById`, and `deleteAuthToken` already exist from PLAN-04.

However, add a `deleteExpiredTokens` cleanup function (optional, called on login to clean stale tokens):

```typescript
export async function deleteExpiredTokens(): Promise<void> {
  const db = getDb();
  await db.delete(authTokens).where(sql`${authTokens.expiresAt} < ${Date.now()}`);
}
```

Add the `sql` import at the top:

```typescript
import { eq, sql } from "drizzle-orm";
```
</action>

<acceptance_criteria>
- `apps/web/lib/auth.ts` has `deleteExpiredTokens()` exported function
- `sql` imported from `drizzle-orm`
- All existing exports remain intact
</acceptance_criteria>

---

### Task 2: Create `apps/web/middleware.ts`

<read_first>
- `apps/web/next.config.ts` — check if middleware configuration needs updating (Next.js 16 may need `matcher` in config or in middleware file)
- Research: In Next.js 16, the `matcher` is exported from `middleware.ts` as a config export. Fetch Next.js 16 middleware docs to verify the exact export convention.

<action>
1. Create `apps/web/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const publicRoutes = [
  "/login",
  "/register",
  "/api/auth",
  "/_next",
];

// Static files that should always be accessible
const publicExtensions = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".css", ".js", ".woff", ".woff2", ".ttf", ".eot",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (publicExtensions.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }

  // Allow root favicon
  if (pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Check for auth token cookie
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Match all routes except specific Next.js internal paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - allow all image formats
     * - publicRoutes are checked inside the middleware function
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

2. If next.config.ts needs a middleware source directory config, verify none is needed. The default Next.js 16 setup reads `middleware.ts` from the app root (`apps/web/`).

3. Verify export convention by fetching Next.js 16 middleware docs and confirming the `matcher` config export is correct.

Important: The middleware must run on the **Edge runtime** by default (Next.js does this automatically for middleware). Since we only check cookie presence (not DB verification), this is fine. Actual token verification happens in API routes.
</action>

<acceptance_criteria>
- `apps/web/middleware.ts` exists at the correct location
- `publicRoutes` list includes: `/login`, `/register`, `/api/auth`, `/_next`
- Static file extensions are allowed through
- Missing `auth-token` cookie redirects to `/login?redirect=<original_path>`
- Existing `auth-token` cookie allows request through
- `config.matcher` uses the broad `/((?!_next/static|_next/image|favicon.ico).*)` pattern
- No infinite redirect loops (login/register paths are excluded)
</acceptance_criteria>

---

### Task 3: Add logout endpoint

<read_first>
- `apps/web/app/api/auth/login/route.ts` — pattern for auth API routes
- `apps/web/lib/auth.ts` — `deleteAuthToken`, `verifyAuthToken`
</read_first>

<action>
1. Create `apps/web/app/api/auth/logout/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { deleteAuthToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (token) {
      // Delete from DB (ignore errors — best effort)
      try {
        await deleteAuthToken(token);
      } catch {
        // Token may already be expired/deleted
      }
    }

    // Clear the cookie
    const response = Response.json({ ok: true });
    response.headers.set(
      "Set-Cookie",
      `auth-token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; ${
        process.env.NODE_ENV === "production" ? "Secure; " : ""
      }`
    );

    return response;
  } catch (e: unknown) {
    const err = e as Error;
    console.error("POST /api/auth/logout error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/logout/route.ts` exists
- Reads `auth-token` cookie
- Deletes token from `auth_tokens` table (best effort, ignores DB errors)
- Clears cookie with `Max-Age=0`
- Returns `{ ok: true }` on success
- Cookie clearing respects `Secure` flag for production
</acceptance_criteria>

---

### Task 4: Verify middleware doesn't break app routes

<read_first>
- `apps/web/app/page.tsx` — main app page (should be behind auth)
- `apps/web/app/api/chat/route.ts` — all API routes under `/api/` except `/api/auth/*` should be protected
</read_first>

<action>
1. Start the dev server:

```bash
pnpm dev
```

2. Navigate to `/` — should redirect to `/login?redirect=/`
3. Log in at `/login` — should redirect to `/` with valid cookie
4. After login, `/` should render the main chat interface
5. Navigate to `/register` — should show register form (public)
6. Navigate to `/api/auth/register` directly — should be accessible (public)
7. Navigate to `/api/chat` directly without cookie — middleware will redirect (API routes return HTML redirect, which is fine for Phase 1)
</action>

<acceptance_criteria>
- Unauthenticated GET `/` → redirects to `/login?redirect=/`
- Unauthenticated GET `/api/*` (non-auth) → redirects to `/login`
- Unauthenticated GET `/login` → renders login page
- Unauthenticated GET `/register` → renders register page
- Unauthenticated GET `/api/auth/*` → passes through middleware
- Authenticated (valid cookie) GET `/` → renders main app
- Static assets (`/_next/static/*`, images) pass through
- No redirect loops
</acceptance_criteria>

---

## Verification Criteria

1. Middleware redirects unauthenticated users to `/login` with `redirect` query param
2. Login/register pages are accessible without auth
3. `/api/auth/*` routes are accessible without auth
4. Valid cookie allows access to protected routes
5. Logout clears both cookie and DB token
6. Static assets load correctly (CSS, JS, images)
7. No redirect loops under any scenario
8. `pnpm dev` starts without errors

## Must Haves

- `middleware.ts` at `apps/web/middleware.ts`
- Public routes list: `/login`, `/register`, `/api/auth`
- Cookie-based check (no DB call in middleware — keeps Edge runtime fast)
- Config matcher excludes `_next/static`, `_next/image`, `favicon.ico`
- Logout endpoint (`POST /api/auth/logout`) that clears cookie + DB token
- Redirect preserves original path via `?redirect=` query param
