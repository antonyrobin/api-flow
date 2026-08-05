import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { auth } from "../lib/auth";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}

interface Session {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Get the current session from a request context.
 * Returns null if no valid session exists.
 */
export async function getSession(c: Context<any>): Promise<Session | null> {
  const authInstance = auth(c.env);

  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers,
  });

  return session as Session | null;
}

/**
 * Middleware: Require authentication.
 * Returns 401 if no valid session exists.
 * Attaches user and session to the context variables.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: {
    user: SessionUser;
    session: Session["session"];
  };
}>(async (c, next) => {
  const session = await getSession(c);

  if (!session) {
    return c.json({ error: { message: "Authentication required" } }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

/**
 * Middleware: Optional authentication.
 * Does NOT block unauthenticated requests, but attaches user if present.
 * Use for endpoints that work for both guests and logged-in users.
 */
export const optionalAuth = createMiddleware<{
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
    session: Session["session"] | null;
  };
}>(async (c, next) => {
  const session = await getSession(c);

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});
