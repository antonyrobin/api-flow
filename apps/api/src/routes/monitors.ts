import { Hono } from "hono";
import { validateJson } from "../lib/validate";
import { eq, and, desc, inArray, lt, count } from "drizzle-orm";
import { createDb, monitors, monitorLogs, type Database } from "@api-flow/db";
import {
  createMonitorSchema,
  updateMonitorSchema,
  runMonitorsSchema,
  MONITOR_LIMITS,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import { isDevelopment, type Env } from "../types";
import { requireAuth } from "../middleware/auth";
import { checkRateLimit, rateLimitedResponse } from "../middleware/rate-limit";
import { assertSafeUrl, OutboundRequestError } from "../lib/http";
import { pruneMonitorLogs, runMonitorCheck } from "../lib/monitor-check";

const MAX_EXPORT_ROWS = 20000;

export const monitorsRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

// Monitors are a saved feature — sign-in required
monitorsRoutes.use("*", requireAuth);

type MonitorRow = typeof monitors.$inferSelect;
type MonitorLogRow = typeof monitorLogs.$inferSelect;

function serializeMonitor(row: MonitorRow, lastCheck?: MonitorLogRow | null) {
  let headers: Record<string, string> = {};
  try {
    headers = JSON.parse(row.headers || "{}");
  } catch {
    // keep empty
  }
  return {
    id: row.id,
    name: row.name,
    method: row.method,
    url: row.url,
    headers,
    body: row.body,
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    expectedStatus: row.expectedStatus,
    isEnabled: row.isEnabled,
    runInBackground: row.runInBackground,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastCheck: lastCheck ?? null,
  };
}

async function getOwnedMonitor(db: Database, id: string, userId: string) {
  return db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
    .get();
}

/**
 * Tell the monitor's Durable Object to start, reschedule or stop its alarm.
 * The DO re-reads the row from D1, so this only needs the id.
 */
export async function syncBackgroundScheduler(env: Env, monitorId: string, action: "sync" | "cancel") {
  const stub = env.MONITOR_SCHEDULER.get(env.MONITOR_SCHEDULER.idFromName(monitorId));
  const res = await stub.fetch(
    new Request(`https://internal/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitorId }),
    })
  );
  if (!res.ok) throw new Error(`Monitor scheduler ${action} failed: ${res.status}`);
}

export function validateMonitorUrl(env: Env, url: string): string | null {
  try {
    assertSafeUrl(url, isDevelopment(env));
    return null;
  } catch (err) {
    return err instanceof OutboundRequestError ? err.message : "Invalid URL";
  }
}

/** Escape a CSV cell and neutralise spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// ============================================
// GET /monitors — List monitors with their latest check
// ============================================
monitorsRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;

  const rows = await db
    .select()
    .from(monitors)
    .where(eq(monitors.userId, userId))
    .orderBy(monitors.sortOrder, monitors.createdAt);

  // Latest log per monitor in a single query
  const latest = await c.env.DB.prepare(
    `SELECT l.id, l.monitor_id AS monitorId, l.status_code AS statusCode,
            l.response_time_ms AS responseTimeMs, l.is_success AS isSuccess,
            l.error_message AS errorMessage, l.created_at AS createdAt
       FROM monitor_logs l
       JOIN (SELECT monitor_id, MAX(created_at) AS max_created
               FROM monitor_logs WHERE user_id = ?1 GROUP BY monitor_id) m
         ON m.monitor_id = l.monitor_id AND m.max_created = l.created_at
      WHERE l.user_id = ?1`
  )
    .bind(userId)
    .all<MonitorLogRow & { isSuccess: number | boolean }>();

  const latestByMonitor = new Map(
    latest.results.map((l) => [l.monitorId, { ...l, isSuccess: !!l.isSuccess }])
  );

  return c.json({
    data: rows.map((row) => serializeMonitor(row, latestByMonitor.get(row.id))),
  });
});

// ============================================
// POST /monitors — Create a monitor
// ============================================
monitorsRoutes.post("/", validateJson(createMonitorSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const body = c.req.valid("json") as any;

  const urlError = validateMonitorUrl(c.env, body.url);
  if (urlError) return c.json({ error: { message: urlError } }, 400);

  const existing = await db
    .select({ total: count() })
    .from(monitors)
    .where(eq(monitors.userId, userId))
    .get();
  if ((existing?.total ?? 0) >= MONITOR_LIMITS.maxMonitorsPerUser) {
    return c.json(
      { error: { message: `You can create up to ${MONITOR_LIMITS.maxMonitorsPerUser} monitors` } },
      400
    );
  }

  const now = nowISO();
  const row: MonitorRow = {
    id: nanoid(),
    userId,
    name: body.name,
    method: body.method,
    url: body.url,
    headers: JSON.stringify(body.headers ?? {}),
    body: body.body ?? null,
    intervalSeconds: body.intervalSeconds,
    timeoutMs: body.timeoutMs,
    expectedStatus: body.expectedStatus ?? null,
    isEnabled: body.isEnabled ?? true,
    runInBackground: body.runInBackground ?? false,
    sortOrder: existing?.total ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(monitors).values(row);
  if (row.runInBackground && row.isEnabled) {
    await syncBackgroundScheduler(c.env, row.id, "sync");
  }

  return c.json({ data: serializeMonitor(row) }, 201);
});

// ============================================
// POST /monitors/run — Execute health checks for the given monitors
// ============================================
monitorsRoutes.post("/run", validateJson(runMonitorsSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const { ids } = c.req.valid("json") as { ids: string[] };

  if (!(await checkRateLimit(c, "monitors", userId))) {
    return rateLimitedResponse(c, false);
  }

  const targets = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.userId, userId), inArray(monitors.id, [...new Set(ids)])));

  const allowPrivateHosts = isDevelopment(c.env);
  const logs = await Promise.all(targets.map((monitor) => runMonitorCheck(monitor, allowPrivateHosts)));

  if (logs.length > 0) {
    await db.batch(
      logs.map((log) => db.insert(monitorLogs).values(log)) as [any, ...any[]]
    );

    // Prune old rows in the background so the table stays bounded
    c.executionCtx.waitUntil(
      Promise.all(logs.map((log) => pruneMonitorLogs(c.env.DB, log.monitorId))).catch((err) => console.error("[Monitors] Failed to prune logs:", err))
    );
  }

  const nameById = new Map(targets.map((m) => [m.id, { name: m.name, url: m.url }]));
  return c.json({
    data: logs.map(({ userId: _userId, ...log }) => ({
      ...log,
      monitorName: nameById.get(log.monitorId)?.name,
      url: nameById.get(log.monitorId)?.url,
    })),
  });
});

// ============================================
// GET /monitors/logs — Paginated check logs
// ?monitorId=&limit=&before=<ISO timestamp>
// ============================================
monitorsRoutes.get("/logs", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const monitorId = c.req.query("monitorId");
  const before = c.req.query("before");
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 100, 1), 500);

  const rows = await db
    .select({
      id: monitorLogs.id,
      monitorId: monitorLogs.monitorId,
      monitorName: monitors.name,
      url: monitors.url,
      statusCode: monitorLogs.statusCode,
      responseTimeMs: monitorLogs.responseTimeMs,
      isSuccess: monitorLogs.isSuccess,
      errorMessage: monitorLogs.errorMessage,
      createdAt: monitorLogs.createdAt,
    })
    .from(monitorLogs)
    .innerJoin(monitors, eq(monitors.id, monitorLogs.monitorId))
    .where(
      and(
        eq(monitorLogs.userId, userId),
        monitorId ? eq(monitorLogs.monitorId, monitorId) : undefined,
        before ? lt(monitorLogs.createdAt, before) : undefined
      )
    )
    .orderBy(desc(monitorLogs.createdAt))
    .limit(limit);

  return c.json({ data: rows });
});

// ============================================
// GET /monitors/logs/export — Download logs as CSV or JSON
// ?format=csv|json&monitorId=
// ============================================
monitorsRoutes.get("/logs/export", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const monitorId = c.req.query("monitorId");
  const format = c.req.query("format") === "json" ? "json" : "csv";

  const rows = await db
    .select({
      createdAt: monitorLogs.createdAt,
      monitorName: monitors.name,
      method: monitors.method,
      url: monitors.url,
      statusCode: monitorLogs.statusCode,
      responseTimeMs: monitorLogs.responseTimeMs,
      isSuccess: monitorLogs.isSuccess,
      errorMessage: monitorLogs.errorMessage,
    })
    .from(monitorLogs)
    .innerJoin(monitors, eq(monitors.id, monitorLogs.monitorId))
    .where(
      and(
        eq(monitorLogs.userId, userId),
        monitorId ? eq(monitorLogs.monitorId, monitorId) : undefined
      )
    )
    .orderBy(desc(monitorLogs.createdAt))
    .limit(MAX_EXPORT_ROWS);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `api-flow-monitor-logs-${stamp}.${format}`;

  const content =
    format === "json"
      ? JSON.stringify(rows, null, 2)
      : [
          ["timestamp", "monitor", "method", "url", "status", "response_time_ms", "result", "error"].join(","),
          ...rows.map((r) =>
            [
              r.createdAt,
              r.monitorName,
              r.method,
              r.url,
              r.statusCode,
              r.responseTimeMs,
              r.isSuccess ? "UP" : "DOWN",
              r.errorMessage,
            ]
              .map(csvCell)
              .join(",")
          ),
        ].join("\n");

  return c.body(content, 200, {
    "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  });
});

// ============================================
// DELETE /monitors/logs — Clear logs (all, or one monitor via ?monitorId=)
// ============================================
monitorsRoutes.delete("/logs", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const monitorId = c.req.query("monitorId");

  await db
    .delete(monitorLogs)
    .where(
      and(
        eq(monitorLogs.userId, userId),
        monitorId ? eq(monitorLogs.monitorId, monitorId) : undefined
      )
    );

  return c.json({ data: { cleared: true, monitorId: monitorId ?? null } });
});

// ============================================
// PATCH /monitors/:id — Update a monitor
// ============================================
monitorsRoutes.patch("/:id", validateJson(updateMonitorSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");
  const body = c.req.valid("json") as any;

  const existing = await getOwnedMonitor(db, id, userId);
  if (!existing) {
    return c.json({ error: { message: "Monitor not found" } }, 404);
  }

  if (body.url !== undefined) {
    const urlError = validateMonitorUrl(c.env, body.url);
    if (urlError) return c.json({ error: { message: urlError } }, 400);
  }

  const updates: Partial<MonitorRow> = { updatedAt: nowISO() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.method !== undefined) updates.method = body.method;
  if (body.url !== undefined) updates.url = body.url;
  if (body.headers !== undefined) updates.headers = JSON.stringify(body.headers);
  if (body.body !== undefined) updates.body = body.body;
  if (body.intervalSeconds !== undefined) updates.intervalSeconds = body.intervalSeconds;
  if (body.timeoutMs !== undefined) updates.timeoutMs = body.timeoutMs;
  if (body.expectedStatus !== undefined) updates.expectedStatus = body.expectedStatus;
  if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;
  if (body.runInBackground !== undefined) updates.runInBackground = body.runInBackground;

  await db.update(monitors).set(updates).where(eq(monitors.id, id));

  // Start, reschedule or stop the background alarm when anything it depends on changed
  const merged = { ...existing, ...updates };
  const wasBackground = existing.runInBackground && existing.isEnabled;
  const isBackground = merged.runInBackground && merged.isEnabled;
  if (wasBackground || isBackground) {
    await syncBackgroundScheduler(c.env, id, isBackground ? "sync" : "cancel");
  }

  return c.json({ data: serializeMonitor(merged) });
});

// ============================================
// DELETE /monitors/:id — Delete a monitor (and its logs)
// ============================================
monitorsRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const existing = await getOwnedMonitor(db, id, userId);
  if (!existing) {
    return c.json({ error: { message: "Monitor not found" } }, 404);
  }

  // Delete logs explicitly — D1 does not enforce ON DELETE CASCADE unless
  // foreign keys are enabled for the connection.
  await db.batch([
    db.delete(monitorLogs).where(eq(monitorLogs.monitorId, id)),
    db.delete(monitors).where(eq(monitors.id, id)),
  ]);
  if (existing.runInBackground) await syncBackgroundScheduler(c.env, id, "cancel");

  return c.json({ data: { id, deleted: true } });
});
