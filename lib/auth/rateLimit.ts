/**
 * lib/auth/rateLimit.ts
 * In-memory rate limiter — 5 attempts per 15 minutes per IP.
 *
 * Note: Resets on cold starts (acceptable for Vercel serverless).
 * For persistent rate limiting, use Vercel KV.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// In-memory store (process-scoped)
const store = new Map<string, RateLimitEntry>();

// Prune stale entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check and increment rate limit for an IP.
 * Returns { allowed, remaining, retryAfterSeconds? }
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip);

  // Window expired — reset
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  // Within window
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

/**
 * Reset rate limit for an IP (call on successful login).
 */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}
