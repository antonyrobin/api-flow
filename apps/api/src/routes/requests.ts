import { Hono } from "hono";
import { validateJson } from "../lib/validate";
import { eq, and, desc } from "drizzle-orm";
import { createDb, requests, collections, collectionFolders, type Database } from "@api-flow/db";
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

/**
 * Verify that the target collection / folder (if any) belong to the user,
 * so requests cannot be attached to another user's collection.
 */
async function validateParents(
  db: Database,
  userId: string,
  collectionId?: string | null,
  folderId?: string | null
): Promise<string | null> {
  if (collectionId) {
    const collection = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .get();
    if (!collection) return "Collection not found";
  }
  if (folderId) {
    if (!collectionId) return "folderId requires collectionId";
    const folder = await db
      .select({ id: collectionFolders.id })
      .from(collectionFolders)
      .where(
        and(
          eq(collectionFolders.id, folderId),
          eq(collectionFolders.collectionId, collectionId)
        )
      )
      .get();
    if (!folder) return "Folder not found";
  }
  return null;
}

// ============================================
// GET /requests — List user's saved requests
// ============================================
requestsRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const collectionId = c.req.query("collectionId");
  const folderId = c.req.query("folderId");

  const result = await db
    .select()
    .from(requests)
    .where(
      and(
        eq(requests.userId, userId),
        collectionId ? eq(requests.collectionId, collectionId) : undefined,
        folderId ? eq(requests.folderId, folderId) : undefined
      )
    )
    .orderBy(requests.sortOrder, desc(requests.updatedAt));

  return c.json({ data: result });
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
    .where(and(eq(requests.id, id), eq(requests.userId, userId)))
    .get();

  if (!result) {
    return c.json({ error: { message: "Request not found" } }, 404);
  }

  return c.json({ data: result });
});

// ============================================
// POST /requests — Create a new saved request
// ============================================
requestsRoutes.post(
  "/",
  validateJson(createRequestSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const body = c.req.valid("json") as any;
    const now = nowISO();

    const parentError = await validateParents(db, userId, body.collectionId, body.folderId);
    if (parentError) {
      return c.json({ error: { message: parentError } }, 400);
    }

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
  validateJson(updateRequestSchema),
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

    // Moving to another collection drops the old folder unless a new one is given
    if (
      body.collectionId !== undefined &&
      body.folderId === undefined &&
      (body.collectionId ?? null) !== existing.collectionId
    ) {
      body.folderId = null;
    }

    if (body.collectionId !== undefined || body.folderId !== undefined) {
      const parentError = await validateParents(
        db,
        userId,
        body.collectionId !== undefined ? body.collectionId : existing.collectionId,
        body.folderId !== undefined ? body.folderId : existing.folderId
      );
      if (parentError) {
        return c.json({ error: { message: parentError } }, 400);
      }
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
    if (body.collectionId !== undefined) updates.collectionId = body.collectionId || null;
    if (body.folderId !== undefined) updates.folderId = body.folderId || null;

    await db
      .update(requests)
      .set(updates)
      .where(and(eq(requests.id, id), eq(requests.userId, userId)));

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
