interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
const store = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

export interface RateLimitOptions {
  limit?: number; // max requests allowed in the window
  windowMs?: number; // window duration in ms
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment rate limit for a given key.
 * Default: 5 attempts per 15 minutes.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000; // 15 minutes default
  const now = Date.now();

  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    // New or expired window
    const record: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, record);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: record.resetAt,
    };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Reset rate limit record on successful login
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
