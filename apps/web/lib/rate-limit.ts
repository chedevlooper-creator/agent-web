interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(key: string, config: RateLimitConfig): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export const CHAT_RATE_LIMIT = { windowMs: 60000, maxRequests: 20 };
export const API_RATE_LIMIT = { windowMs: 60000, maxRequests: 100 };
export const TOOL_RATE_LIMIT = { windowMs: 60000, maxRequests: 30 };
