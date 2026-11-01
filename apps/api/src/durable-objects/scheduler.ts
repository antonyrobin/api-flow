import { DurableObject } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { createDb, scheduleLogs, schedules } from "@api-flow/db";
import { nanoid, nowISO } from "@api-flow/shared";
import { safeFetch } from "../lib/http";
import { isDevelopment, type Env } from "../types";

interface ScheduleConfig {
  scheduleId: string;
  requestId: string;
  intervalSeconds: number;
  cronExpression?: string;
  maxRetries?: number;
  isActive?: boolean;
  requestConfig: {
    method: string;
    url: string;
    headers: string; // JSON string
    body: string | null;
  };
}

/**
 * SchedulerDO — Durable Object for executing scheduled API calls.
 *
 * Each scheduled job gets its own Durable Object instance,
 * providing per-job isolation and horizontal scaling.
 *
 * Uses Durable Object Alarms for "at-least-once" execution
 * with retry and exponential backoff on network failures.
 */
export class SchedulerDO extends DurableObject<Env> {
  /**
   * Handle HTTP requests from the Worker.
   * Used for lifecycle management (init, update, cancel).
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case "/init":
        return this.handleInit(request);
      case "/update":
        return this.handleUpdate(request);
      case "/cancel":
        return this.handleCancel();
      case "/status":
        return this.handleStatus();
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Initialize the schedule and set the first alarm.
   */
  private async handleInit(request: Request): Promise<Response> {
    const config: ScheduleConfig = await request.json();
    const isActive = config.isActive ?? true;

    // Store configuration in Durable Object storage
    await this.ctx.storage.put("config", config);
    await this.ctx.storage.put("isActive", isActive);
    await this.ctx.storage.put("retryCount", 0);

    const nextRunMs = Date.now() + config.intervalSeconds * 1000;
    if (isActive) {
      await this.ctx.storage.setAlarm(nextRunMs);
    }

    console.log(
      `[Scheduler] Initialized schedule ${config.scheduleId}, ` +
        (isActive ? `next run in ${config.intervalSeconds}s` : "paused")
    );

    return Response.json({ status: "initialized", nextRunMs });
  }

  /**
   * Update the schedule interval and/or active state.
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const { intervalSeconds, isActive, maxRetries } = (await request.json()) as {
      intervalSeconds?: number;
      isActive?: boolean;
      maxRetries?: number;
    };

    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    if (!config) {
      return new Response("Schedule not configured", { status: 400 });
    }

    if (intervalSeconds !== undefined) config.intervalSeconds = intervalSeconds;
    if (maxRetries !== undefined) config.maxRetries = maxRetries;
    await this.ctx.storage.put("config", config);

    const active = isActive ?? (await this.ctx.storage.get<boolean>("isActive")) ?? false;
    await this.ctx.storage.put("isActive", active);

    if (active) {
      // (Re)schedule the next alarm with the current interval
      await this.ctx.storage.setAlarm(Date.now() + config.intervalSeconds * 1000);
    } else {
      // Pause: cancel pending alarm
      await this.ctx.storage.deleteAlarm();
    }

    return Response.json({ status: "updated" });
  }

  /**
   * Cancel the schedule and clean up.
   */
  private async handleCancel(): Promise<Response> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();

    console.log("[Scheduler] Schedule cancelled");

    return Response.json({ status: "cancelled" });
  }

  /**
   * Get the current status of the schedule.
   */
  private async handleStatus(): Promise<Response> {
    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    const isActive = await this.ctx.storage.get<boolean>("isActive");
    const alarm = await this.ctx.storage.getAlarm();

    return Response.json({
      configured: !!config,
      isActive,
      nextAlarm: alarm ? new Date(alarm).toISOString() : null,
    });
  }

  /**
   * Alarm handler — triggered at the scheduled time.
   * Executes the API request and stores the result in D1.
   */
  async alarm(): Promise<void> {
    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    const isActive = await this.ctx.storage.get<boolean>("isActive");

    if (!config || !isActive) {
      console.log("[Scheduler] Alarm fired but schedule is inactive or unconfigured");
      return;
    }

    const startTime = Date.now();
    let statusCode: number | undefined;
    let isSuccess = true;
    let errorMessage: string | undefined;
    let networkFailure = false;

    try {
      // Parse headers from JSON string (array of { key, value, enabled })
      const headers: Record<string, string> = {};
      try {
        const parsed = JSON.parse(config.requestConfig.headers);
        if (Array.isArray(parsed)) {
          parsed
            .filter((h: { enabled?: boolean; key?: string }) => h.enabled !== false && h.key)
            .forEach((h: { key: string; value: string }) => {
              headers[h.key] = h.value;
            });
        }
      } catch {
        // Headers might be empty or malformed
      }

      const result = await safeFetch(config.requestConfig.url, {
        method: config.requestConfig.method,
        headers,
        body: config.requestConfig.body,
        timeoutMs: 30_000,
        maxBytes: 64 * 1024, // body is discarded, only status matters
        allowPrivateHosts: isDevelopment(this.env),
      });

      statusCode = result.status;
      isSuccess = statusCode >= 200 && statusCode < 400;
      if (!isSuccess) errorMessage = `HTTP ${statusCode}`;
    } catch (err) {
      isSuccess = false;
      networkFailure = true;
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    const timingTotalMs = Date.now() - startTime;
    const now = nowISO();

    // Decide when to run next: retry with backoff on network failures,
    // otherwise wait for the regular interval.
    const retryCount = (await this.ctx.storage.get<number>("retryCount")) || 0;
    const maxRetries = config.maxRetries ?? 3;
    let nextRunMs = Date.now() + config.intervalSeconds * 1000;

    if (networkFailure && retryCount < maxRetries) {
      const backoffMs = Math.min(2 ** retryCount * 5_000, config.intervalSeconds * 1000);
      nextRunMs = Date.now() + backoffMs;
      await this.ctx.storage.put("retryCount", retryCount + 1);
    } else {
      await this.ctx.storage.put("retryCount", 0);
    }

    // Persist the execution log and run timestamps
    try {
      const db = createDb(this.env.DB);
      await db.batch([
        db.insert(scheduleLogs).values({
          id: nanoid(),
          scheduleId: config.scheduleId,
          statusCode: statusCode ?? null,
          timingTotalMs,
          isSuccess,
          errorMessage: errorMessage?.slice(0, 500) ?? null,
          createdAt: now,
        }),
        db
          .update(schedules)
          .set({
            lastRunAt: now,
            nextRunAt: new Date(nextRunMs).toISOString(),
            updatedAt: now,
          })
          .where(eq(schedules.id, config.scheduleId)),
      ]);
    } catch (err) {
      console.error("[Scheduler] Failed to persist log:", err);
    }

    await this.ctx.storage.setAlarm(nextRunMs);
  }
}
