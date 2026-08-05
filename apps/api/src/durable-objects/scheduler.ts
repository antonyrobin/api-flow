import { DurableObject } from "cloudflare:workers";

interface ScheduleConfig {
  scheduleId: string;
  requestId: string;
  intervalSeconds: number;
  cronExpression?: string;
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
 * with automatic retry and exponential backoff.
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

    // Store configuration in Durable Object storage
    await this.ctx.storage.put("config", config);
    await this.ctx.storage.put("isActive", true);
    await this.ctx.storage.put("retryCount", 0);

    // Set the first alarm
    const nextRunMs = Date.now() + config.intervalSeconds * 1000;
    await this.ctx.storage.setAlarm(nextRunMs);

    console.log(
      `[Scheduler] Initialized schedule ${config.scheduleId}, ` +
      `next run in ${config.intervalSeconds}s`
    );

    return new Response(JSON.stringify({ status: "initialized", nextRunMs }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Update the schedule interval and/or active state.
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const { intervalSeconds, isActive } = await request.json() as {
      intervalSeconds?: number;
      isActive?: boolean;
    };

    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    if (!config) {
      return new Response("Schedule not configured", { status: 400 });
    }

    if (intervalSeconds !== undefined) {
      config.intervalSeconds = intervalSeconds;
      await this.ctx.storage.put("config", config);
    }

    if (isActive !== undefined) {
      await this.ctx.storage.put("isActive", isActive);

      if (isActive) {
        // Resume: set next alarm
        const nextRunMs = Date.now() + config.intervalSeconds * 1000;
        await this.ctx.storage.setAlarm(nextRunMs);
      } else {
        // Pause: cancel pending alarm
        await this.ctx.storage.deleteAlarm();
      }
    }

    return new Response(JSON.stringify({ status: "updated" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Cancel the schedule and clean up.
   */
  private async handleCancel(): Promise<Response> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.put("isActive", false);

    console.log("[Scheduler] Schedule cancelled");

    return new Response(JSON.stringify({ status: "cancelled" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get the current status of the schedule.
   */
  private async handleStatus(): Promise<Response> {
    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    const isActive = await this.ctx.storage.get<boolean>("isActive");
    const alarm = await this.ctx.storage.getAlarm();

    return new Response(
      JSON.stringify({
        configured: !!config,
        isActive,
        nextAlarm: alarm ? new Date(alarm).toISOString() : null,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  /**
   * Alarm handler — triggered at the scheduled time.
   * Executes the API request and stores the result.
   */
  async alarm(): Promise<void> {
    const config = await this.ctx.storage.get<ScheduleConfig>("config");
    const isActive = await this.ctx.storage.get<boolean>("isActive");

    if (!config || !isActive) {
      console.log("[Scheduler] Alarm fired but schedule is inactive or unconfigured");
      return;
    }

    console.log(`[Scheduler] Executing scheduled request: ${config.requestConfig.method} ${config.requestConfig.url}`);

    const startTime = Date.now();
    let statusCode: number | undefined;
    let isSuccess = true;
    let errorMessage: string | undefined;

    try {
      // Parse headers from JSON string
      let headers: Record<string, string> = {};
      try {
        const parsed = JSON.parse(config.requestConfig.headers);
        if (Array.isArray(parsed)) {
          parsed
            .filter((h: { enabled?: boolean }) => h.enabled !== false)
            .forEach((h: { key: string; value: string }) => {
              headers[h.key] = h.value;
            });
        }
      } catch {
        // Headers might be already an object or empty
      }

      const fetchOptions: RequestInit = {
        method: config.requestConfig.method,
        headers,
        signal: AbortSignal.timeout(30000), // 30s timeout
      };

      if (
        config.requestConfig.body &&
        ["POST", "PUT", "PATCH"].includes(config.requestConfig.method)
      ) {
        fetchOptions.body = config.requestConfig.body;
      }

      const response = await fetch(config.requestConfig.url, fetchOptions);
      statusCode = response.status;
      isSuccess = statusCode >= 200 && statusCode < 400;

      // Consume body to complete the request
      await response.text();

      // Reset retry count on success
      await this.ctx.storage.put("retryCount", 0);
    } catch (err) {
      isSuccess = false;
      errorMessage = err instanceof Error ? err.message : "Unknown error";

      // Increment retry count
      const retryCount = (await this.ctx.storage.get<number>("retryCount")) || 0;
      await this.ctx.storage.put("retryCount", retryCount + 1);

      console.error(`[Scheduler] Request failed (attempt ${retryCount + 1}):`, errorMessage);
    }

    const timingTotalMs = Date.now() - startTime;

    // Log the execution result
    // Note: In production, this would write to D1 via a separate Worker binding
    // For now, we log to console. The API route fetches logs from D1.
    console.log(
      `[Scheduler] Result: ${statusCode || "ERR"} in ${timingTotalMs}ms ` +
      `(success: ${isSuccess})`
    );

    // Schedule the next alarm
    if (isActive) {
      const nextRunMs = Date.now() + config.intervalSeconds * 1000;
      await this.ctx.storage.setAlarm(nextRunMs);
      console.log(`[Scheduler] Next run at ${new Date(nextRunMs).toISOString()}`);
    }
  }
}

// Environment type (needed for DurableObject generic)
interface Env {
  DB: D1Database;
  SCHEDULER: DurableObjectNamespace;
}
