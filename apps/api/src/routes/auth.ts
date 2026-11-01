import { Hono } from "hono";
import type { Env } from "../types";
import { auth, configuredProviders } from "../lib/auth";
import { getSession } from "../middleware/auth";

/**
 * Auth routes — delegates to Better Auth for all authentication flows.
 *
 * Better Auth handles:
 * - POST /auth/sign-up/email      — Email registration
 * - POST /auth/sign-in/email      — Email login
 * - POST /auth/sign-in/social     — Social login (Google, Apple)
 * - GET  /auth/callback/:provider  — OAuth callback
 * - POST /auth/sign-out           — Sign out
 * - GET  /auth/get-session        — Get current session
 * - GET  /auth/verify-email       — Email verification
 * - POST /auth/request-password-reset — Password reset email
 * - POST /auth/reset-password     — Set a new password from the emailed token
 * - POST /auth/send-verification-email — Resend the verification email
 */
export const authRoutes = new Hono<{ Bindings: Env }>();

// ============================================
// Custom auth endpoints
// (registered before the catch-all so they are reachable)
// ============================================

// GET /auth/providers — Which social sign-in providers are configured
authRoutes.get("/providers", (c) => {
  return c.json({ data: configuredProviders(c.env) });
});

// GET /auth/me — Get the current user's profile
authRoutes.get("/me", async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.json({ user: null }, 200);
  }

  return c.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image,
    },
  });
});

// Proxy all other auth requests to the Better Auth handler
authRoutes.on(["GET", "POST"], "/*", (c) => {
  // Better Auth expects a standard Request and returns a standard Response
  return auth(c.env).handler(c.req.raw);
});
