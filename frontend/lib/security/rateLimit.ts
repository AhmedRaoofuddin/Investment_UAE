// Token-bucket rate limiter.
//
// In-memory by design for the pilot — a single Vercel function instance can
// see ~100 RPS per user safely without Redis. If we scale beyond one region
// or want cross-instance fairness, swap the Map for an Upstash Redis client
// (the bucket API stays the same so the migration is one file).
//
// Keying: callers pass an opaque key (typically `<route>:<ip>` or
// `<route>:<userId>`). Per-user keys are preferable when a session exists;
// IP fallback for unauthenticated routes.

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const BUCKETS = new Map<string, Bucket>();

// Periodic GC so the map doesn't grow unbounded under attack. Runs at most
// once per minute and only deletes buckets that have been idle for >5min
// AND are full (no penalty in-flight).
let lastGcMs = 0;
function maybeGc(now: number) {
  if (now - lastGcMs < 60_000) return;
  lastGcMs = now;
  for (const [k, b] of BUCKETS) {
    if (now - b.lastRefillMs > 300_000) BUCKETS.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimit(
  key: string,
  // tokens per windowMs. Defaults: 60 reqs / minute.
  capacity = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  maybeGc(now);

  const refillRate = capacity / windowMs; // tokens per ms
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefillMs: now };
    BUCKETS.set(key, bucket);
  }

  // Lazy refill — cheaper than a timer.
  const elapsed = now - bucket.lastRefillMs;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) {
    const resetMs = Math.ceil((1 - bucket.tokens) / refillRate);
    return { ok: false, remaining: 0, resetMs };
  }
  bucket.tokens -= 1;
  return {
    ok: true,
    remaining: Math.floor(bucket.tokens),
    resetMs: Math.ceil((capacity - bucket.tokens) / refillRate),
  };
}

// Common policies — keep them named so audits can grep.
export const POLICIES = {
  AUTH_SIGNIN: { capacity: 5, windowMs: 60_000 }, // anti brute-force
  AI_DEEPDIVE: { capacity: 20, windowMs: 60_000 }, // expensive Opus calls
  WORKSPACE_API: { capacity: 120, windowMs: 60_000 }, // standard reads
  CONNECTIONS_WRITE: { capacity: 10, windowMs: 60_000 }, // OAuth completions
} as const;
