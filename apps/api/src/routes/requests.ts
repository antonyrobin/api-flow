import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { createDb, requests } from "@api-flow/db";
import {
  createRequestSchema,
  updateRequestSchema,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { requireAuth } from "../middleware/auth";

export const requestsRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

// All request routes require authentication
requestsRoutes.use("*", requireAuth);

// ============================================
// GET /requests — List user's saved requests
// ============================================
requestsRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const collectionId = c.req.query("collectionId");
  const folderId = c.req.query("folderId");

  let query = db
    .select()
    .from(requests)
    .where(eq(requests.userId, userId))
    .orderBy(requests.sortOrder);

  const result = await query;

  // Filter in JS if needed (D1 doesn't support dynamic where chains well)
  let filtered = result;
  if (collectionId) {
    filtered = filtered.filter((r) => r.collectionId === collectionId);
  }
  if (folderId) {
    filtered = filtered.filter((r) => r.folderId === folderId);
  }

  return c.json({ data: filtered });
});

// ============================================
// GET /requests/:id — Get a single request
// ============================================
requestsRoutes.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id))
    .get();

  if (!result || result.userId !== userId) {
    return c.json({ error: { message: "Request not found" } }, 404);
  }

  return c.json({ data: result });
});

// ============================================
// POST /requests — Create a new saved request
// ============================================
requestsRoutes.post(
  "/",
  zValidator("json", createRequestSchema as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const body = c.req.valid("json") as any;
    const now = nowISO();

    const newRequest = {
      id: nanoid(),
      userId,
      collectionId: body.collectionId || null,
      folderId: body.folderId || null,
      name: body.name,
      method: body.method,
      url: body.url,
      headers: JSON.stringify(body.headers),
      queryParams: JSON.stringify(body.queryParams),
      body: body.body,
      bodyType: body.bodyType,
      authType: body.authType,
      authConfig: JSON.stringify(body.authConfig),
      preRequestScript: body.preRequestScript || null,
      testScript: body.testScript || null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(requests).values(newRequest);

    return c.json({ data: newRequest }, 201);
  }
);

// ============================================
// PATCH /requests/:id — Update a saved request
// ============================================
requestsRoutes.patch(
  "/:id",
  zValidator("json", updateRequestSchema as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const id = c.req.param("id");
    const body = c.req.valid("json") as any;

    const existing = await db
      .select()
      .from(requests)
      .where(eq(requests.id, id))
      .get();

    if (!existing || existing.userId !== userId) {
      return c.json({ error: { message: "Request not found" } }, 404);
    }

    const updates: Record<string, unknown> = { updatedAt: nowISO() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.method !== undefined) updates.method = body.method;
    if (body.url !== undefined) updates.url = body.url;
    if (body.headers !== undefined) updates.headers = JSON.stringify(body.headers);
    if (body.queryParams !== undefined) updates.queryParams = JSON.stringify(body.queryParams);
    if (body.body !== undefined) updates.body = body.body;
    if (body.bodyType !== undefined) updates.bodyType = body.bodyType;
    if (body.authType !== undefined) updates.authType = body.authType;
    if (body.authConfig !== undefined) updates.authConfig = JSON.stringify(body.authConfig);
    if (body.preRequestScript !== undefined) updates.preRequestScript = body.preRequestScript;
    if (body.testScript !== undefined) updates.testScript = body.testScript;
    if (body.collectionId !== undefined) updates.collectionId = body.collectionId;
    if (body.folderId !== undefined) updates.folderId = body.folderId;

    await db.update(requests).set(updates).where(eq(requests.id, id));

    return c.json({ data: { id, ...updates } });
  }
);

// ============================================
// DELETE /requests/:id — Delete a saved request
// ============================================
requestsRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(requests)
    .where(eq(requests.id, id))
    .get();

  if (!existing || existing.userId !== userId) {
    return c.json({ error: { message: "Request not found" } }, 404);
  }

  await db.delete(requests).where(eq(requests.id, id));

  return c.json({ data: { id, deleted: true } });
});
