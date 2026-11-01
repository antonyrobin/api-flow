import type { Context } from "hono";
import type { Env, RateLimiter } from "../types";

/**
 * Fallback limiter used when the Cloudflare Rate Limiting binding is not
 * configured. It is per-isolate (best effort), but still stops a single
 * client from hammering the proxy from one connection.
 */
const fallbackWindows = new Map<string, { count: number; resetAt: number }>();

function fallbackLimit(key: string, limit: number, periodMs = 60_000): boolean {
  const now = Date.now();
  const entry = fallbackWindows.get(key);

  if (!entry || entry.resetAt <= now) {
    // Keep the map bounded
    if (fallbackWindows.size > 10_000) fallbackWindows.clear();
    fallbackWindows.set(key, { count: 1, resetAt: now + periodMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Check the per-user (authenticated) or per-IP (guest) rate limit.
 * Returns true when the request may proceed.
 */
export async function checkRateLimit(
  c: Context<{ Bindings: Env; Variables: any }>,
  scope: string,
  userId: string | null
): Promise<boolean> {
  const limiter: RateLimiter | undefined = userId
    ? c.env.USER_RATE_LIMITER
    : c.env.GUEST_RATE_LIMITER;
  const key = `${scope}:${userId ? `u:${userId}` : `ip:${clientIp(c)}`}`;

  if (limiter) {
    try {
      const { success } = await limiter.limit({ key });
      return success;
    } catch (err) {
      console.error("[RateLimit] Limiter binding failed, using fallback:", err);
    }
  }

  return fallbackLimit(key, userId ? 120 : 30);
}

export function rateLimitedResponse(c: Context, isGuest: boolean) {
  return c.json(
    {
      error: {
        message: isGuest
          ? "Too many requests. Please wait a minute, or sign in for a higher limit."
          : "Too many requests. Please wait a minute and try again.",
      },
    },
    429,
    { "Retry-After": "60" }
  );
}
