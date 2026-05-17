import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api/auth"];

// ===== In-memory rate limiter (sliding window) =====
interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodically sweep stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) rateLimitStore.delete(key);
  }
}, 60_000).unref();

function getRateLimitKey(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const path = request.nextUrl.pathname;
  return `${ip}:${path}`;
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }
  // Prune old entries
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  // Count within window
  const count = entry.timestamps.length;
  if (count >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  entry.timestamps.push(now);
  return { allowed: true, remaining: maxRequests - count - 1, retryAfter: 0 };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to all requests
  const isApi = pathname.startsWith("/api/");
  const limitConfig = isApi
    ? { max: 60, window: 60_000 }
    : { max: 300, window: 60_000 };

  const key = getRateLimitKey(request);
  const { allowed, remaining, retryAfter } = checkRateLimit(
    key,
    limitConfig.max,
    limitConfig.window
  );

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limitConfig.max),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(limitConfig.max));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/favicon")
  ) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(limitConfig.max));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("session_token");

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limitConfig.max));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
