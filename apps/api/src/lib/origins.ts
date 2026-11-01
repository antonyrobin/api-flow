import { isDevelopment, type Env } from "../types";

const DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Exact list of browser origins allowed to call the API with credentials.
 * Used by both CORS and Better Auth's trusted origins (CSRF protection).
 */
export function getAllowedOrigins(env: Env): string[] {
  const origins = new Set<string>();

  const add = (value?: string) => {
    if (!value) return;
    try {
      origins.add(new URL(value.trim()).origin);
    } catch {
      // Ignore malformed entries
    }
  };

  add(env.NEXT_PUBLIC_APP_URL);
  env.ALLOWED_ORIGINS?.split(",").forEach(add);

  if (isDevelopment(env)) {
    DEV_ORIGINS.forEach(add);
  }

  return [...origins];
}
