import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

import { isDevelopment, type Env } from "./types";
import { getAllowedOrigins } from "./lib/origins";
import { authRoutes } from "./routes/auth";
import { collectionsRoutes } from "./routes/collections";
import { requestsRoutes } from "./routes/requests";
import { environmentsRoutes } from "./routes/environments";
import { schedulesRoutes } from "./routes/schedules";
import { proxyRoutes } from "./routes/proxy";
import { monitorsRoutes } from "./routes/monitors";
import { backupRoutes } from "./routes/backup";
import { SchedulerDO } from "./durable-objects/scheduler";
import { MonitorSchedulerDO } from "./durable-objects/monitor-scheduler";

// Re-export Durable Object class for Wrangler
export { SchedulerDO, MonitorSchedulerDO };

// ============================================
// App Type Definition (shared with frontend via Hono RPC)
// ============================================

const app = new Hono<{ Bindings: Env }>();

// ============================================
// Global Middleware
// ============================================

app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  secureHeaders({
    // Pure JSON API — nothing should frame or embed it
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    crossOriginResourcePolicy: "cross-origin",
  })
);
app.use(
  "*",
  cors({
    // Exact-match allowlist. Requests without an Origin header (curl, server-to-server)
    // get no CORS headers, which is fine — CORS only matters to browsers.
    origin: (origin, c) => (getAllowedOrigins(c.env as Env).includes(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Disposition", "Retry-After"],
    credentials: true,
    maxAge: 86400,
  })
);
// Request bodies above 2 MB are rejected (proxy payloads + saved requests).
// Backup imports set their own, larger limit in routes/backup.ts.
const defaultBodyLimit = bodyLimit({
  maxSize: 2 * 1024 * 1024,
  onError: (c) => c.json({ error: { message: "Request body too large (max 2 MB)" } }, 413),
});
app.use("*", (c, next) => (c.req.path === "/backup/import" ? next() : defaultBodyLimit(c, next)));

// ============================================
// Health Check
// ============================================

app.get("/", (c) => {
  return c.json({
    name: "API Flow",
    version: "0.1.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Route Modules
// ============================================

const routes = app
  .route("/auth", authRoutes)
  .route("/collections", collectionsRoutes)
  .route("/requests", requestsRoutes)
  .route("/environments", environmentsRoutes)
  .route("/schedules", schedulesRoutes)
  .route("/monitors", monitorsRoutes)
  .route("/backup", backupRoutes)
  .route("/proxy", proxyRoutes);

// ============================================
// Global Error Handler
// ============================================

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message } }, err.status);
  }

  console.error(`[Error] ${err.message}`, err.stack);
  const isDev = isDevelopment(c.env);
  return c.json(
    {
      error: {
        // Never leak internal error details in production
        message: isDev ? err.message || "Internal Server Error" : "Internal Server Error",
        ...(isDev && { stack: err.stack }),
      },
    },
    500
  );
});

app.notFound((c) => {
  return c.json({ error: { message: "Not Found" } }, 404);
});

// ============================================
// Export App Type (for Hono RPC client)
// ============================================

export type AppType = typeof routes;
export default app;
