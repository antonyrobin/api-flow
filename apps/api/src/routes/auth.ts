import { Hono } from "hono";
import { createDb } from "@api-flow/db";
import type { Env } from "../types";
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
 * - GET  /auth/session            — Get current session
 * - POST /auth/verify-email       — Email verification
 * - POST /auth/forgot-password    — Password reset request
 * - POST /auth/reset-password     — Password reset
 */
export const authRoutes = new Hono<{ Bindings: Env }>();

// Proxy all auth requests to Better Auth handler
authRoutes.all("/*", async (c) => {
  const { auth } = await import("../lib/auth");
  const authInstance = auth(c.env);

  // Better Auth expects a standard Request and returns a standard Response
  return authInstance.handler(c.req.raw);
});

// ============================================
// Custom auth endpoints
// ============================================

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
