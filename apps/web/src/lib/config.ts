/**
 * Public runtime configuration and site-wide SEO constants.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100").replace(/\/$/, "");

export const SITE = {
  name: "API Flow",
  title: "API Flow — Free Online API Testing & Uptime Monitoring",
  shortDescription: "Test, save and monitor REST APIs from your browser.",
  description:
    "API Flow is a free, browser-based API client. Send HTTP requests without signing up, save requests to collections, and monitor multiple endpoints with scheduled health checks and downloadable logs.",
  keywords: [
    "API testing",
    "online API tester",
    "REST client",
    "HTTP client",
    "Postman alternative",
    "API monitoring",
    "uptime monitor",
    "health check",
    "heartbeat monitor",
    "API debugging",
  ],
} as const;

/**
 * Only allow same-site relative redirects (prevents open-redirect via ?next=).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
