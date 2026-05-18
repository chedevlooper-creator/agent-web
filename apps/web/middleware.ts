import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/api/auth", "/share"];

// ===== In-memory rate limiter (sliding window) =====
interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

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

// Simpler locale handling without next-intl middleware
function getLocaleFromRequest(request: NextRequest): string {
  // Check cookie first
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale === "en" || cookieLocale === "tr") return cookieLocale;

  // Check Accept-Language header
  const acceptLang = request.headers.get("Accept-Language");
  if (acceptLang) {
    if (acceptLang.startsWith("en")) return "en";
    if (acceptLang.startsWith("tr")) return "tr";
  }

  return "tr";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Apply rate limiting to API routes
  const isApi = pathname.startsWith("/api/");
  if (isApi) {
    const key = getRateLimitKey(request);
    const { allowed, remaining, retryAfter } = checkRateLimit(key, 60, 60_000);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Allow public API routes with rate limit headers
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Limit", "60");
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }

    // For protected API routes, rate limit check passed, continue
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", "60");
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  // Set locale cookie for page routes
  const locale = getLocaleFromRequest(request);
  const response = NextResponse.next();
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  // Allow public page routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return response;
  }

  // Check for session cookie on protected page routes (custom cookie or NextAuth JWT)
  const sessionToken = request.cookies.get("session_token");
  const nextAuthToken = request.cookies.get("authjs.session-token") || request.cookies.get("__Secure-authjs.session-token");
  if (!sessionToken && !nextAuthToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
