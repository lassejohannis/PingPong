/**
 * Simple in-memory sliding-window rate limiter.
 * Good enough for initial launch on Vercel (per-instance).
 * For production, replace with Upstash Redis.
 */

export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  // Periodic cleanup to prevent memory leaks
  if (typeof globalThis !== "undefined") {
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of hits) {
        const valid = timestamps.filter((t) => now - t < options.windowMs);
        if (valid.length === 0) hits.delete(key);
        else hits.set(key, valid);
      }
    }, 5 * 60_000).unref?.();
  }

  return {
    check(identifier: string): { success: boolean; remaining: number } {
      const now = Date.now();
      const timestamps = (hits.get(identifier) || []).filter(
        (t) => now - t < options.windowMs
      );
      if (timestamps.length >= options.max) {
        hits.set(identifier, timestamps);
        return { success: false, remaining: 0 };
      }
      timestamps.push(now);
      hits.set(identifier, timestamps);
      return { success: true, remaining: options.max - timestamps.length };
    },
  };
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}
