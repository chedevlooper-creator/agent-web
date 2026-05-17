---
id: 01-user-registration-auth-pages-plan05
phase: 1
wave: 2
depends_on:
  - PLAN-04
files_modified:
  - apps/web/middleware.ts
  - apps/web/app/api/auth/logout/route.ts
  - apps/web/lib/auth.ts
autonomous: true
requirements:
  - AUTH-05
  - AUTH-06
  - UI-04
---

# Plan 05: Auth Middleware & Logout

## Objective

Create Next.js middleware to protect routes behind authentication and implement logout functionality.

## Tasks

### Task 5.1: Create Next.js middleware

<read_first>
- apps/web/next.config.ts (check if middleware config needed)
- apps/web/app/layout.tsx (root layout)
</read_first>

<action>
Create `apps/web/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  
  // Check for session cookie
  const sessionToken = request.cookies.get("session_token");
  
  if (!sessionToken) {
    // Redirect to login for page requests
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Return 401 for API requests
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  return NextResponse.next();
}

// Note: Token validation in middleware would require edge-compatible DB access.
// Full validation happens on the API routes server-side.
// Middleware only checks cookie presence as a first gate.

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

**Design note:** Middleware runs on the Edge runtime by default. The cookie presence check is a lightweight first gate. The actual DB token validation will be added in Phase 3 when we implement full data isolation. For now, cookie presence is sufficient for the MVP.
</action>

<acceptance_criteria>
- `apps/web/middleware.ts` exists
- `/login`, `/register`, `/api/auth/*` are accessible without cookie
- `/` redirects to `/login` when no session cookie
- `/api/*` (non-auth) returns 401 when no session cookie
- Static files (`/_next/*`) are not blocked
- Config matcher is properly configured
</acceptance_criteria>

### Task 5.2: Create logout functionality

<read_first>
- apps/web/lib/auth.ts (for deleteSession)
- apps/web/app/api/auth/login/route.ts (for cookie pattern)
</read_first>

<action>
1. Add `getSessionToken` helper to `apps/web/lib/auth.ts` (extracts token from request cookies):

```typescript
export function getSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  return match?.[1] ?? null;
}
```

2. Create `apps/web/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    
    if (token) {
      await deleteSession(token);
    }
    
    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
    
    // Clear the session cookie
    response.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Delete immediately
    });
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
```
</action>

<acceptance_criteria>
- `apps/web/app/api/auth/logout/route.ts` exists with POST handler
- POST /api/auth/logout clears the session cookie (maxAge=0)
- POST /api/auth/logout removes the token from auth_tokens table
- Returns 200 with success message
</acceptance_criteria>

## Verification Criteria

1. Unauthenticated visit to `/` redirects to `/login?redirect=/`
2. Unauthenticated visit to `/api/sessions` returns 401
3. After login, `/` loads normally
4. POST /api/auth/logout clears the cookie
5. After logout, `/` redirects to `/login` again
6. Login page has `redirect` query param that works

## must_haves

- Unauthenticated users cannot access protected pages
- Unauthenticated API calls return 401
- Logout invalidates the session token server-side
- Middleware does not block public routes
