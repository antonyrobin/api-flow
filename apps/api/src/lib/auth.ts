import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@api-flow/db/schema";
import { isDevelopment, type Env } from "../types";
import { getAllowedOrigins } from "./origins";
import {
  existingAccountEmail,
  passwordChangedEmail,
  resetPasswordEmail,
  sendEmail,
  verificationEmail,
  welcomeEmail,
  type EmailMessage,
} from "./email";

/** Long-lived sessions: 30 days, silently extended while the user stays active */
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 30;
const SESSION_UPDATE_AGE = 60 * 60 * 24;

/**
 * Social providers that have credentials configured. The web app asks
 * GET /auth/providers so it only offers buttons that will work.
 */
export function configuredProviders(env: Env) {
  return {
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    // Sign in with Apple stays off until APPLE_SIGNIN_ENABLED=true (in addition to its credentials)
    apple: env.APPLE_SIGNIN_ENABLED === "true" && !!(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET),
  };
}

// One Better Auth instance per isolate + env binding set. Building it (adapter,
// providers, plugins) on every request was measurable overhead on each API call.
const instances = new WeakMap<Env, ReturnType<typeof createAuth>>();

export function auth(env: Env) {
  let instance = instances.get(env);
  if (!instance) {
    instance = createAuth(env);
    instances.set(env, instance);
  }
  return instance;
}

/**
 * Create a Better Auth instance configured for:
 * - Email/password with email verification and password reset (emails via Resend)
 * - Google OAuth / Apple Sign-In (only when credentials are configured)
 * - Drizzle + D1 database adapter
 *
 * Cached per env object (see auth() above): bindings are fixed for the
 * lifetime of an isolate, so the instance can be reused across requests.
 */
function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  const isDev = isDevelopment(env);

  if (!isDev && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }

  const appUrl = (env.NEXT_PUBLIC_APP_URL || "http://localhost:3100").replace(/\/$/, "");

  // Email failures are logged, never surfaced as auth failures — the user can
  // always ask for the email again (resend verification / forgot password).
  const deliver = async (to: string, message: Omit<EmailMessage, "to">) => {
    try {
      await sendEmail(env, { to, ...message });
    } catch (err) {
      console.error(`[Auth] ${message.subject}: ${(err as Error).message}`);
    }
  };

  const providers = configuredProviders(env);
  const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
  if (providers.google) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    };
  }
  if (providers.apple) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      // Native iOS apps would add their bundle id here
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER || undefined,
    };
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    // Routes are mounted under /auth (see routes/auth.ts and web auth-client)
    basePath: "/auth",

    // Email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deliver(user.email, resetPasswordEmail(user.name, url));
      },
      onPasswordReset: async ({ user }) => {
        await deliver(user.email, passwordChangedEmail(user.name));
      },
      onExistingUserSignUp: async ({ user }) => {
        await deliver(user.email, existingAccountEmail(user.name, appUrl));
      },
    },

    // Email verification
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        if (isDev && !env.RESEND_API_KEY) {
          console.log(`[Auth] Verification link for ${user.email}: ${url}`);
        }
        await deliver(user.email, verificationEmail(user.name, url));
      },
      afterEmailVerification: async (user) => {
        await deliver(user.email, welcomeEmail(user.name, appUrl));
      },
    },

    socialProviders,

    // Social sign-ups arrive already verified — greet them here
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.emailVerified) await deliver(user.email, welcomeEmail(user.name, appUrl));
          },
        },
      },
    },

    // Long sessions: valid for 30 days and rolled forward (new expiry) at most
    // once a day while the user keeps using the app, so active users stay signed in.
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: SESSION_UPDATE_AGE,
      // Sensitive actions (e.g. deleting the account) need a sign-in from the last day
      freshAge: 60 * 60 * 24,
    },

    // Let users link Google/Apple to an existing email account with the same address
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
    },

    // Brute-force protection on sign-in / sign-up endpoints
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },

    advanced: {
      // Rate limits are per client IP. Cloudflare sets cf-connecting-ip (clients can't
      // spoof it); without this Better Auth found no IP and used one bucket shared by
      // every user, so a few bad sign-ins could lock everyone out.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: !isDev,
      // The web app and API live on different sites in production
      // (pages.dev / workers.dev), so the session cookie must be SameSite=None.
      defaultCookieAttributes: isDev
        ? { sameSite: "lax", httpOnly: true }
        : { sameSite: "none", secure: true, httpOnly: true, partitioned: true },
    },

    // Security
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || undefined,

    // Trusted origins (CSRF protection for cookie-based requests)
    // Apple posts the OAuth callback from its own origin (response_mode=form_post)
    trustedOrigins: [...getAllowedOrigins(env), ...(providers.apple ? ["https://appleid.apple.com"] : [])],
  });
}

export type Auth = ReturnType<typeof auth>;
