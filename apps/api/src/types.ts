/**
 * Cloudflare Workers Rate Limiting binding.
 * Configured under `unsafe.bindings` in wrangler.jsonc.
 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Cloudflare Worker environment bindings type definition.
 */
export interface Env {
  // Cloudflare D1 database
  DB: D1Database;

  // Durable Objects
  SCHEDULER: DurableObjectNamespace;
  MONITOR_SCHEDULER: DurableObjectNamespace;

  // Rate limiters (optional — falls back to a per-isolate limiter if missing)
  GUEST_RATE_LIMITER?: RateLimiter;
  USER_RATE_LIMITER?: RateLimiter;

  // Environment variables
  // "development" enables localhost origins, private-network proxying and
  // detailed error output. Anything else is treated as production.
  APP_ENV: string;

  // Better Auth secrets
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // OAuth providers
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_CLIENT_SECRET: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;

  // Transactional email (Resend — https://resend.com)
  RESEND_API_KEY?: string;
  // e.g. "API Flow <noreply@yourdomain.com>" — domain must be verified in Resend
  EMAIL_FROM?: string;

  // App URLs
  NEXT_PUBLIC_APP_URL: string;
  // Extra comma-separated origins allowed to call the API with credentials
  ALLOWED_ORIGINS?: string;
}

export function isDevelopment(env: Pick<Env, "APP_ENV">): boolean {
  return env.APP_ENV === "development";
}
