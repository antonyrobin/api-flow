import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@api-flow/db/schema";
import type { Env } from "../types";

/**
 * Create a Better Auth instance configured for:
 * - Email/password with email verification
 * - Google OAuth
 * - Apple Sign-In
 * - Drizzle + D1 database adapter
 *
 * This is called per-request because Cloudflare Workers
 * don't have persistent process-level state for env bindings.
 */
export function auth(env: Env) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),

    // Email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },

    // Email verification
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        // TODO: Integrate with email service (Resend, SendGrid, etc.)
        // For now, log the verification URL in development
        console.log(`[Auth] Verification email for ${user.email}: ${url}`);
      },
    },

    // Social providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,      // Update session every 24 hours
    },

    // Security
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Trusted origins (for CORS)
    trustedOrigins: [
      env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ],
  });
}

export type Auth = ReturnType<typeof auth>;
