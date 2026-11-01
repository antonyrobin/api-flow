import { monitors, monitorLogs } from "@api-flow/db";
import { nanoid, nowISO } from "@api-flow/shared";
import { safeFetch } from "./http";

/** Logs kept per monitor; older rows are pruned after each run */
export const MAX_LOGS_PER_MONITOR = 2000;

type MonitorRow = typeof monitors.$inferSelect;
type MonitorLogRow = typeof monitorLogs.$inferSelect;

/**
 * Execute one health check and build the `monitor_logs` row for it.
 * Shared by `POST /monitors/run` (client-driven) and MonitorSchedulerDO (background).
 */
export async function runMonitorCheck(
  monitor: MonitorRow,
  allowPrivateHosts: boolean
): Promise<MonitorLogRow> {
  const start = Date.now();
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  let isSuccess = false;

  try {
    let headers: Record<string, string> = {};
    try {
      headers = JSON.parse(monitor.headers || "{}");
    } catch {
      // ignore malformed headers
    }

    const result = await safeFetch(monitor.url, {
      method: monitor.method,
      headers,
      body: monitor.body,
      timeoutMs: monitor.timeoutMs,
      maxBytes: 64 * 1024, // only status + timing matter
      allowPrivateHosts,
    });

    statusCode = result.status;
    isSuccess = monitor.expectedStatus
      ? statusCode === monitor.expectedStatus
      : statusCode >= 200 && statusCode < 400;
    if (!isSuccess) {
      errorMessage = monitor.expectedStatus
        ? `Expected ${monitor.expectedStatus}, got ${statusCode}`
        : `HTTP ${statusCode}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  return {
    id: nanoid(),
    monitorId: monitor.id,
    userId: monitor.userId,
    statusCode,
    responseTimeMs: Date.now() - start,
    isSuccess,
    errorMessage: errorMessage?.slice(0, 500) ?? null,
    createdAt: nowISO(),
  };
}

/** Delete all but the newest MAX_LOGS_PER_MONITOR rows for a monitor. */
export function pruneMonitorLogs(db: D1Database, monitorId: string) {
  return db
    .prepare(
      `DELETE FROM monitor_logs
        WHERE monitor_id = ?1
          AND created_at < COALESCE((SELECT created_at FROM monitor_logs
                            WHERE monitor_id = ?1
                            ORDER BY created_at DESC
                            LIMIT 1 OFFSET ?2), '')`
    )
    .bind(monitorId, MAX_LOGS_PER_MONITOR - 1)
    .run();
}
