/**
 * Cloudflare Worker environment bindings type definition.
 */
export interface Env {
  // Cloudflare D1 database
  DB: D1Database;

  // Durable Objects
  SCHEDULER: DurableObjectNamespace;

  // Environment variables
  APP_ENV: string;

  // Better Auth secrets
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // OAuth providers
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_CLIENT_SECRET: string;

  // Email / SMTP
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;

  // App URLs
  NEXT_PUBLIC_APP_URL: string;
}
