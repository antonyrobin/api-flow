import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { createDb, monitorLogs, monitors } from "@api-flow/db";
import { MONITOR_LIMITS } from "@api-flow/shared/validators";
import { pruneMonitorLogs, runMonitorCheck } from "../lib/monitor-check";
import { isDevelopment, type Env } from "../types";

/**
 * MonitorSchedulerDO — runs one endpoint monitor in the background.
 *
 * One instance per monitor (`idFromName(monitorId)`). The DO only stores the
 * monitor id; every alarm re-reads the row from D1, so edits apply on the next
 * check and a deleted, paused or foreground-only monitor stops its own alarm.
 */
export class MonitorSchedulerDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/sync":
        return this.handleSync(request);
      case "/cancel":
        return this.handleCancel();
      case "/status":
        return this.handleStatus();
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Start, reschedule or stop the alarm to match the monitor's current row.
   * Called after create / update / toggle.
   */
  private async handleSync(request: Request): Promise<Response> {
    const { monitorId } = (await request.json()) as { monitorId: string };
    await this.ctx.storage.put("monitorId", monitorId);

    const monitor = await this.loadMonitor(monitorId);
    if (!monitor || !monitor.isEnabled || !monitor.runInBackground) {
      await this.stop();
      return Response.json({ status: "stopped" });
    }

    // First check runs right away, later ones on the monitor's interval
    const nextRunMs = Date.now() + 1000;
    await this.ctx.storage.setAlarm(nextRunMs);
    console.log(`[MonitorScheduler] Started monitor ${monitorId}, every ${monitor.intervalSeconds}s`);
    return Response.json({ status: "scheduled", nextRunMs });
  }

  private async handleCancel(): Promise<Response> {
    await this.stop();
    return Response.json({ status: "cancelled" });
  }

  private async handleStatus(): Promise<Response> {
    const monitorId = await this.ctx.storage.get<string>("monitorId");
    const alarm = await this.ctx.storage.getAlarm();
    return Response.json({
      monitorId: monitorId ?? null,
      nextAlarm: alarm ? new Date(alarm).toISOString() : null,
    });
  }

  async alarm(): Promise<void> {
    const monitorId = await this.ctx.storage.get<string>("monitorId");
    if (!monitorId) return;

    const monitor = await this.loadMonitor(monitorId);
    if (!monitor || !monitor.isEnabled || !monitor.runInBackground) {
      console.log(`[MonitorScheduler] Monitor ${monitorId} no longer runs in background, stopping`);
      await this.stop();
      return;
    }

    const intervalMs = Math.max(monitor.intervalSeconds, MONITOR_LIMITS.minIntervalSeconds) * 1000;
    // Schedule the next run first so a failure below never stops the monitor
    await this.ctx.storage.setAlarm(Date.now() + intervalMs);

    const log = await runMonitorCheck(monitor, isDevelopment(this.env));
    try {
      await createDb(this.env.DB).insert(monitorLogs).values(log);
      await pruneMonitorLogs(this.env.DB, monitor.id);
    } catch (err) {
      console.error("[MonitorScheduler] Failed to persist log:", err);
    }
  }

  private async loadMonitor(monitorId: string) {
    return createDb(this.env.DB).select().from(monitors).where(eq(monitors.id, monitorId)).get();
  }

  private async stop() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
