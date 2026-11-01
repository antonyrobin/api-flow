import { Hono } from "hono";
import { validateJson } from "../lib/validate";
import { eq, and, inArray } from "drizzle-orm";
import { createDb, environments, environmentVariables, type Database } from "@api-flow/db";
import {
  createEnvironmentSchema,
  updateEnvironmentSchema,
  createVariableSchema,
  updateVariableSchema,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { requireAuth } from "../middleware/auth";

export const environmentsRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

environmentsRoutes.use("*", requireAuth);

async function ownsEnvironment(db: Database, envId: string, userId: string) {
  const env = await db
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.id, envId), eq(environments.userId, userId)))
    .get();
  return !!env;
}

// ============================================
// GET /environments — List user's environments
// ============================================
environmentsRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;

  const envs = await db
    .select()
    .from(environments)
    .where(eq(environments.userId, userId));

  // Variables for all environments in one query (instead of one per environment)
  const vars = envs.length
    ? await db
        .select()
        .from(environmentVariables)
        .where(inArray(environmentVariables.environmentId, envs.map((e) => e.id)))
        .orderBy(environmentVariables.sortOrder)
    : [];

  const result = envs.map((env) => ({
    ...env,
    variables: vars
      .filter((v) => v.environmentId === env.id)
      .map((v) => ({
        ...v,
        // Mask secret values in list view
        value: v.isSecret ? "••••••••" : v.value,
      })),
  }));

  return c.json({ data: result });
});

// ============================================
// POST /environments — Create environment
// ============================================
environmentsRoutes.post(
  "/",
  validateJson(createEnvironmentSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const body = c.req.valid("json") as any;
    const now = nowISO();

    // If this is set as active, deactivate others
    if (body.isActive) {
      await db
        .update(environments)
        .set({ isActive: false, updatedAt: now })
        .where(eq(environments.userId, userId));
    }

    const newEnv = {
      id: nanoid(),
      userId,
      name: body.name,
      isActive: body.isActive ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(environments).values(newEnv);

    return c.json({ data: newEnv }, 201);
  }
);

// ============================================
// PATCH /environments/:id — Update environment
// ============================================
environmentsRoutes.patch(
  "/:id",
  validateJson(updateEnvironmentSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const id = c.req.param("id");
    const body = c.req.valid("json") as any;
    const now = nowISO();

    const existing = await db
      .select()
      .from(environments)
      .where(eq(environments.id, id))
      .get();

    if (!existing || existing.userId !== userId) {
      return c.json({ error: { message: "Environment not found" } }, 404);
    }

    // If activating this environment, deactivate others
    if (body.isActive) {
      await db
        .update(environments)
        .set({ isActive: false, updatedAt: now })
        .where(eq(environments.userId, userId));
    }

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.name !== undefined) updates.name = body.name;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    await db.update(environments).set(updates).where(eq(environments.id, id));

    return c.json({ data: { id, ...updates } });
  }
);

// ============================================
// DELETE /environments/:id — Delete environment
// ============================================
environmentsRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(environments)
    .where(eq(environments.id, id))
    .get();

  if (!existing || existing.userId !== userId) {
    return c.json({ error: { message: "Environment not found" } }, 404);
  }

  await db.delete(environments).where(eq(environments.id, id));

  return c.json({ data: { id, deleted: true } });
});

// ============================================
// POST /environments/:id/variables — Add variable
// ============================================
environmentsRoutes.post(
  "/:id/variables",
  validateJson(createVariableSchema.omit({ environmentId: true })),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const envId = c.req.param("id");
    const body = c.req.valid("json") as any;

    // Verify environment ownership
    const env = await db
      .select()
      .from(environments)
      .where(eq(environments.id, envId))
      .get();

    if (!env || env.userId !== userId) {
      return c.json({ error: { message: "Environment not found" } }, 404);
    }

    const newVar = {
      id: nanoid(),
      environmentId: envId,
      key: body.key,
      value: body.value,
      isSecret: body.isSecret ?? false,
      sortOrder: 0,
    };

    await db.insert(environmentVariables).values(newVar);

    return c.json({ data: newVar }, 201);
  }
);

// ============================================
// PATCH /environments/:envId/variables/:varId — Update variable
// ============================================
environmentsRoutes.patch(
  "/:envId/variables/:varId",
  validateJson(updateVariableSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const envId = c.req.param("envId");
    const varId = c.req.param("varId");
    const body = c.req.valid("json") as any;

    if (!(await ownsEnvironment(db, envId, userId))) {
      return c.json({ error: { message: "Environment not found" } }, 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.key !== undefined) updates.key = body.key;
    if (body.value !== undefined) updates.value = body.value;
    if (body.isSecret !== undefined) updates.isSecret = body.isSecret;

    await db
      .update(environmentVariables)
      .set(updates)
      .where(
        and(
          eq(environmentVariables.id, varId),
          eq(environmentVariables.environmentId, envId)
        )
      );

    return c.json({ data: { id: varId, ...updates } });
  }
);

// ============================================
// DELETE /environments/:envId/variables/:varId — Delete variable
// ============================================
environmentsRoutes.delete("/:envId/variables/:varId", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const envId = c.req.param("envId");
  const varId = c.req.param("varId");

  if (!(await ownsEnvironment(db, envId, userId))) {
    return c.json({ error: { message: "Environment not found" } }, 404);
  }

  await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.id, varId),
        eq(environmentVariables.environmentId, envId)
      )
    );

  return c.json({ data: { id: varId, deleted: true } });
});
