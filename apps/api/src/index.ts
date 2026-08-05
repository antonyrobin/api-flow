import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";

import type { Env } from "./types";
import { authRoutes } from "./routes/auth";
import { collectionsRoutes } from "./routes/collections";
import { requestsRoutes } from "./routes/requests";
import { environmentsRoutes } from "./routes/environments";
import { schedulesRoutes } from "./routes/schedules";
import { proxyRoutes } from "./routes/proxy";
import { SchedulerDO } from "./durable-objects/scheduler";

// Re-export Durable Object class for Wrangler
export { SchedulerDO };

// ============================================
// App Type Definition (shared with frontend via Hono RPC)
// ============================================

const app = new Hono<{ Bindings: Env }>();

// ============================================
// Global Middleware
// ============================================

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow localhost and production domain
      if (!origin) return "*";
      if (origin.includes("localhost")) return origin;
      if (origin.includes("apiflow.dev")) return origin;
      return "";
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  })
);

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
  .route("/proxy", proxyRoutes);

// ============================================
// Global Error Handler
// ============================================

app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);
  return c.json(
    {
      error: {
        message: err.message || "Internal Server Error",
        ...(c.env.APP_ENV === "development" && { stack: err.stack }),
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
