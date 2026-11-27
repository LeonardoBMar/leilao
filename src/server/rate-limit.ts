import "server-only";

/**
 * Rate limiter leve em memória por usuário e rota para a API v1 (D-98, ARCHITECTURE §17).
 * Janela deslizante sem dependência externa (adequado ao Free Tier; reinicia em cold start).
 */

type Bucket = {
  timestamps: number[];
  expiresAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

export type RateLimitResult = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

export function checkUserRateLimit(
  userId: string,
  routeKey: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): RateLimitResult {
  const key = `${routeKey}:${userId}`;
  const cutoff = nowMs - windowMs;

  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    for (const [entryKey, entry] of buckets) {
      if (entry.expiresAt <= nowMs) buckets.delete(entryKey);
    }
    // Se ainda estiver no teto após remover expirados, aplica eviction FIFO.
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
  }

  const bucket = buckets.get(key);
  const active = bucket ? bucket.timestamps.filter((ts) => ts > cutoff) : [];

  if (active.length >= limit) {
    const oldest = active[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1_000));
    buckets.set(key, { timestamps: active, expiresAt: (active[active.length - 1] ?? nowMs) + windowMs });
    return { allowed: false, retryAfterSeconds };
  }

  active.push(nowMs);
  buckets.set(key, { timestamps: active, expiresAt: nowMs + windowMs });
  return { allowed: true, remaining: Math.max(0, limit - active.length) };
}
