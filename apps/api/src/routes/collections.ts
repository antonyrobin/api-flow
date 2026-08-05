import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createDb, collections, collectionFolders } from "@api-flow/db";
import {
  createCollectionSchema,
  updateCollectionSchema,
  createFolderSchema,
  updateFolderSchema,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { requireAuth } from "../middleware/auth";

export const collectionsRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

// All collection routes require authentication
collectionsRoutes.use("*", requireAuth);

// ============================================
// GET /collections — List user's collections
// ============================================
collectionsRoutes.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;

  const result = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(collections.sortOrder);

  return c.json({ data: result });
});

// ============================================
// GET /collections/:id — Get a single collection
// ============================================
collectionsRoutes.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();

  if (!result || result.userId !== userId) {
    return c.json({ error: { message: "Collection not found" } }, 404);
  }

  // Get folders for this collection
  const folders = await db
    .select()
    .from(collectionFolders)
    .where(eq(collectionFolders.collectionId, id))
    .orderBy(collectionFolders.sortOrder);

  return c.json({ data: { ...result, folders } });
});

// ============================================
// POST /collections — Create a new collection
// ============================================
collectionsRoutes.post(
  "/",
  zValidator("json", createCollectionSchema as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const body = c.req.valid("json") as any;
    const now = nowISO();

    const newCollection = {
      id: nanoid(),
      userId,
      name: body.name,
      description: body.description || "",
      defaultHeaders: JSON.stringify(body.defaultHeaders),
      variables: JSON.stringify(body.variables),
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(collections).values(newCollection);

    return c.json({ data: newCollection }, 201);
  }
);

// ============================================
// PATCH /collections/:id — Update a collection
// ============================================
collectionsRoutes.patch(
  "/:id",
  zValidator("json", updateCollectionSchema as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const id = c.req.param("id");
    const body = c.req.valid("json") as any;

    // Verify ownership
    const existing = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id))
      .get();

    if (!existing || existing.userId !== userId) {
      return c.json({ error: { message: "Collection not found" } }, 404);
    }

    const updates: Record<string, unknown> = { updatedAt: nowISO() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.defaultHeaders !== undefined)
      updates.defaultHeaders = JSON.stringify(body.defaultHeaders);
    if (body.variables !== undefined)
      updates.variables = JSON.stringify(body.variables);

    await db.update(collections).set(updates).where(eq(collections.id, id));

    return c.json({ data: { id, ...updates } });
  }
);

// ============================================
// DELETE /collections/:id — Delete a collection
// ============================================
collectionsRoutes.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .get();

  if (!existing || existing.userId !== userId) {
    return c.json({ error: { message: "Collection not found" } }, 404);
  }

  await db.delete(collections).where(eq(collections.id, id));

  return c.json({ data: { id, deleted: true } });
});

// ============================================
// POST /collections/:id/folders — Create a folder
// ============================================
collectionsRoutes.post(
  "/:id/folders",
  zValidator("json", createFolderSchema.omit({ collectionId: true }) as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const collectionId = c.req.param("id");
    const body = c.req.valid("json") as any;
    const now = nowISO();

    // Verify collection ownership
    const collection = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .get();

    if (!collection || collection.userId !== userId) {
      return c.json({ error: { message: "Collection not found" } }, 404);
    }

    const newFolder = {
      id: nanoid(),
      collectionId,
      parentFolderId: body.parentFolderId || null,
      name: body.name,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(collectionFolders).values(newFolder);

    return c.json({ data: newFolder }, 201);
  }
);
