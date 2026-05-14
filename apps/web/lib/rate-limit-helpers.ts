import { rateLimit, CHAT_RATE_LIMIT, API_RATE_LIMIT } from './rate-limit';
import { rateLimited } from './errors';

export function checkChatRateLimit(identifier: string): void {
  const result = rateLimit(identifier, CHAT_RATE_LIMIT);
  if (!result.success) {
    const waitSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    throw rateLimited(`Rate limit exceeded. Try again in ${waitSeconds} seconds.`);
  }
}

export function checkApiRateLimit(identifier: string): void {
  const result = rateLimit(identifier, API_RATE_LIMIT);
  if (!result.success) {
    throw rateLimited('API rate limit exceeded. Try again later.');
  }
}
