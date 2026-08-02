/**
 * In-memory sliding-window rate limiter (per serverless instance).
 * Not distributed — it resets on cold starts and is per-instance — but it
 * stops naive scripted abuse at zero infrastructure cost. The hard,
 * persistent cap (max active bookings per phone) lives in the database
 * check inside /api/book.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

/** True if the call is allowed; false if the key exceeded `limit` hits in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    // Cheap protection against unbounded growth from spoofed keys
    if (buckets.size >= MAX_KEYS) buckets.clear();
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) return false;
  bucket.timestamps.push(now);
  return true;
}

/** Best-effort client IP behind Vercel/proxies. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
