import { Hono } from "hono";
import { validateJson } from "../lib/validate";
import { eq, desc } from "drizzle-orm";
import { createDb, schedules, scheduleLogs, requests } from "@api-flow/db";
import {
  createScheduleSchema,
  updateScheduleSchema,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { requireAuth } from "../middleware/auth";

export const schedulesRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

schedulesRoutes.use("*", requireAuth);

// ============================================
// GET /schedules — List user's schedules
// ============================================
schedulesRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;

  const result = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, userId));

  return c.json({ data: result });
});

// ============================================
// GET /schedules/:id — Get schedule with logs
// ============================================
schedulesRoutes.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const schedule = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!schedule || schedule.userId !== userId) {
    return c.json({ error: { message: "Schedule not found" } }, 404);
  }

  // Get recent logs
  const logs = await db
    .select()
    .from(scheduleLogs)
    .where(eq(scheduleLogs.scheduleId, id))
    .orderBy(desc(scheduleLogs.createdAt))
    .limit(50);

  return c.json({ data: { ...schedule, logs } });
});

// ============================================
// POST /schedules — Create a new schedule
// ============================================
schedulesRoutes.post(
  "/",
  validateJson(createScheduleSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const body = c.req.valid("json") as any;
    const now = nowISO();

    // Verify the request exists and belongs to the user
    const request = await db
      .select()
      .from(requests)
      .where(eq(requests.id, body.requestId))
      .get();

    if (!request || request.userId !== userId) {
      return c.json({ error: { message: "Request not found" } }, 404);
    }

    const scheduleId = nanoid();
    const doId = c.env.SCHEDULER.idFromName(scheduleId);
    const isActive = body.isActive ?? true;
    const maxRetries = body.maxRetries ?? 3;
    const nextRunAt = isActive
      ? new Date(Date.now() + body.intervalSeconds * 1000).toISOString()
      : null;

    const newSchedule = {
      id: scheduleId,
      userId,
      requestId: body.requestId,
      name: body.name,
      intervalSeconds: body.intervalSeconds,
      cronExpression: body.cronExpression || null,
      isActive,
      lastRunAt: null,
      nextRunAt,
      durableObjectId: doId.toString(),
      maxRetries,
      createdAt: now,
      updatedAt: now,
    };

    // Insert first so the Durable Object can never run for a schedule that does not exist
    await db.insert(schedules).values(newSchedule);

    try {
      const stub = c.env.SCHEDULER.get(doId);
      await stub.fetch(
        new Request("https://internal/init", {
          method: "POST",
          body: JSON.stringify({
            scheduleId,
            requestId: body.requestId,
            intervalSeconds: body.intervalSeconds,
            cronExpression: body.cronExpression,
            maxRetries,
            isActive,
            requestConfig: {
              method: request.method,
              url: request.url,
              headers: request.headers,
              body: request.body,
            },
          }),
        })
      );
    } catch (err) {
      await db.delete(schedules).where(eq(schedules.id, scheduleId));
      throw err;
    }

    return c.json({ data: newSchedule }, 201);
  }
);

// ============================================
// PATCH /schedules/:id — Update schedule
// ============================================
schedulesRoutes.patch(
  "/:id",
  validateJson(updateScheduleSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const id = c.req.param("id");
    const body = c.req.valid("json") as any;
    const now = nowISO();

    const existing = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id))
      .get();

    if (!existing || existing.userId !== userId) {
      return c.json({ error: { message: "Schedule not found" } }, 404);
    }

    // Update the Durable Object if interval/active changed
    if (existing.durableObjectId) {
      const doId = c.env.SCHEDULER.idFromName(id);
      const stub = c.env.SCHEDULER.get(doId);

      await stub.fetch(
        new Request("https://internal/update", {
          method: "POST",
          body: JSON.stringify({
            intervalSeconds: body.intervalSeconds ?? existing.intervalSeconds,
            isActive: body.isActive ?? existing.isActive,
            maxRetries: body.maxRetries ?? existing.maxRetries,
          }),
        })
      );
    }

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.name !== undefined) updates.name = body.name;
    if (body.intervalSeconds !== undefined) updates.intervalSeconds = body.intervalSeconds;
    if (body.cronExpression !== undefined) updates.cronExpression = body.cronExpression;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.maxRetries !== undefined) updates.maxRetries = body.maxRetries;

    await db.update(schedules).set(updates).where(eq(schedules.id, id));

    return c.json({ data: { id, ...updates } });
  }
);

// ============================================
// DELETE /schedules/:id — Delete schedule
// ============================================
schedulesRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!existing || existing.userId !== userId) {
    return c.json({ error: { message: "Schedule not found" } }, 404);
  }

  // Cancel the Durable Object alarm
  if (existing.durableObjectId) {
    try {
      const doId = c.env.SCHEDULER.idFromName(id);
      const stub = c.env.SCHEDULER.get(doId);
      await stub.fetch(new Request("https://internal/cancel", { method: "POST" }));
    } catch (e) {
      console.error("[Schedules] Failed to cancel DO alarm:", e);
    }
  }

  await db.delete(schedules).where(eq(schedules.id, id));

  return c.json({ data: { id, deleted: true } });
});

// ============================================
// GET /schedules/:id/logs — Get execution logs
// ============================================
schedulesRoutes.get("/:id/logs", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 500);

  const schedule = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!schedule || schedule.userId !== userId) {
    return c.json({ error: { message: "Schedule not found" } }, 404);
  }

  const logs = await db
    .select()
    .from(scheduleLogs)
    .where(eq(scheduleLogs.scheduleId, id))
    .orderBy(desc(scheduleLogs.createdAt))
    .limit(limit);

  return c.json({ data: logs });
});
