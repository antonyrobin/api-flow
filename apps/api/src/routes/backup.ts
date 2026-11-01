import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { eq, inArray, count } from "drizzle-orm";
import {
  createDb,
  collections,
  collectionFolders,
  requests,
  environments,
  environmentVariables,
  monitors,
} from "@api-flow/db";
import {
  backupSchema,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MONITOR_LIMITS,
  type BackupFile,
  type ImportSummary,
} from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { requireAuth } from "../middleware/auth";
import { validateJson } from "../lib/validate";
import { syncBackgroundScheduler, validateMonitorUrl } from "./monitors";

/**
 * Workspace backup & restore.
 *
 * - GET  /backup/export — everything the user owns as one JSON document
 * - POST /backup/import — merge a backup (or a converted Postman export) into the account
 *
 * Imports always create new rows (fresh ids); nothing existing is overwritten.
 */
export const backupRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } };
}>();

backupRoutes.use("*", requireAuth);

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ============================================
// GET /backup/export
// ============================================
backupRoutes.get("/export", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("user").id;

  const [collectionRows, requestRows, environmentRows, monitorRows] = await Promise.all([
    db.select().from(collections).where(eq(collections.userId, userId)).orderBy(collections.sortOrder),
    db.select().from(requests).where(eq(requests.userId, userId)).orderBy(requests.sortOrder),
    db.select().from(environments).where(eq(environments.userId, userId)),
    db.select().from(monitors).where(eq(monitors.userId, userId)).orderBy(monitors.sortOrder),
  ]);

  const collectionIds = collectionRows.map((r) => r.id);
  const environmentIds = environmentRows.map((r) => r.id);
  const [folderRows, variableRows] = await Promise.all([
    collectionIds.length
      ? db.select().from(collectionFolders).where(inArray(collectionFolders.collectionId, collectionIds))
      : Promise.resolve([]),
    environmentIds.length
      ? db
          .select()
          .from(environmentVariables)
          .where(inArray(environmentVariables.environmentId, environmentIds))
          .orderBy(environmentVariables.sortOrder)
      : Promise.resolve([]),
  ]);

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    collections: collectionRows.map((col) => ({
      id: col.id,
      name: col.name,
      description: col.description ?? "",
      variables: parseJson<Record<string, string>>(col.variables, {}),
      folders: folderRows
        .filter((f) => f.collectionId === col.id)
        .map((f) => ({ id: f.id, parentFolderId: f.parentFolderId, name: f.name })),
    })),
    requests: requestRows.map((r) => ({
      collectionId: r.collectionId,
      folderId: r.folderId,
      name: r.name,
      method: r.method as BackupFile["requests"][number]["method"],
      url: r.url,
      headers: parseJson(r.headers, []),
      queryParams: parseJson(r.queryParams, []),
      body: r.body,
      bodyType: r.bodyType as BackupFile["requests"][number]["bodyType"],
      authType: r.authType as BackupFile["requests"][number]["authType"],
      authConfig: parseJson(r.authConfig, {}),
    })),
    environments: environmentRows.map((env) => ({
      name: env.name,
      variables: variableRows
        .filter((v) => v.environmentId === env.id)
        .map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })),
    })),
    monitors: monitorRows.map((m) => ({
      name: m.name,
      method: m.method as BackupFile["monitors"][number]["method"],
      url: m.url,
      headers: parseJson<Record<string, string>>(m.headers, {}),
      body: m.body,
      intervalSeconds: m.intervalSeconds,
      timeoutMs: m.timeoutMs,
      expectedStatus: m.expectedStatus,
      isEnabled: m.isEnabled,
      runInBackground: m.runInBackground,
    })),
  };

  const date = new Date().toISOString().slice(0, 10);
  c.header("Content-Disposition", `attachment; filename="api-flow-backup-${date}.json"`);
  c.header("Cache-Control", "no-store");
  return c.json(backup);
});

// ============================================
// POST /backup/import
// ============================================
backupRoutes.post(
  "/import",
  // Backups can be larger than the global 2 MB API limit
  bodyLimit({
    maxSize: 8 * 1024 * 1024,
    onError: (c) => c.json({ error: { message: "Backup file too large (max 8 MB)" } }, 413),
  }),
  validateJson(backupSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get("user").id;
    const data = c.req.valid("json") as BackupFile;
    const now = nowISO();

    // ----- Map file references to fresh ids -----
    const collectionIdMap = new Map<string, string>();
    const folderIdMap = new Map<string, string>();

    const collectionRows = data.collections.map((col, i) => {
      const id = nanoid();
      collectionIdMap.set(col.id, id);
      return {
        id,
        user_id: userId,
        name: col.name,
        description: col.description ?? "",
        default_headers: "[]",
        variables: JSON.stringify(col.variables ?? {}),
        sort_order: i,
        created_at: now,
        updated_at: now,
      };
    });

    for (const col of data.collections) {
      for (const folder of col.folders) folderIdMap.set(`${col.id}:${folder.id}`, nanoid());
    }
    const folderRows = data.collections.flatMap((col) =>
      col.folders.map((folder, i) => {
        const id = folderIdMap.get(`${col.id}:${folder.id}`)!;
        const collectionId = collectionIdMap.get(col.id)!;
        return {
          id,
          collection_id: collectionId,
          parent_folder_id: folder.parentFolderId
            ? folderIdMap.get(`${col.id}:${folder.parentFolderId}`) ?? null
            : null,
          name: folder.name,
          sort_order: i,
          created_at: now,
          updated_at: now,
        };
      })
    );

    const requestRows = data.requests.map((r, i) => {
      const collectionId = r.collectionId ? collectionIdMap.get(r.collectionId) ?? null : null;
      const folderId =
        collectionId && r.collectionId && r.folderId
          ? folderIdMap.get(`${r.collectionId}:${r.folderId}`) ?? null
          : null;
      return {
        id: nanoid(),
        collection_id: collectionId,
        folder_id: folderId,
        user_id: userId,
        name: r.name,
        method: r.method,
        url: r.url,
        headers: JSON.stringify(r.headers),
        body: r.body,
        body_type: r.bodyType,
        query_params: JSON.stringify(r.queryParams),
        auth_type: r.authType,
        auth_config: JSON.stringify(r.authConfig ?? {}),
        sort_order: i,
        created_at: now,
        updated_at: now,
      };
    });

    const environmentRows: Record<string, unknown>[] = [];
    const variableRows: Record<string, unknown>[] = [];
    for (const env of data.environments) {
      const id = nanoid();
      environmentRows.push({ id, user_id: userId, name: env.name, is_active: 0, created_at: now, updated_at: now });
      env.variables.forEach((v, i) =>
        variableRows.push({
          id: nanoid(),
          environment_id: id,
          key: v.key,
          value: v.value,
          is_secret: v.isSecret ? 1 : 0,
          sort_order: i,
        })
      );
    }

    // ----- Monitors: respect URL safety rules and the per-user limit -----
    const existingMonitors = await db
      .select({ total: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId))
      .get();
    let room = MONITOR_LIMITS.maxMonitorsPerUser - (existingMonitors?.total ?? 0);
    let skippedMonitors = 0;
    const monitorRows: Record<string, unknown>[] = [];
    for (const m of data.monitors) {
      if (room <= 0 || !/^https?:\/\//i.test(m.url) || validateMonitorUrl(c.env, m.url)) {
        skippedMonitors++;
        continue;
      }
      room--;
      monitorRows.push({
        id: nanoid(),
        user_id: userId,
        name: m.name,
        method: m.method,
        url: m.url,
        headers: JSON.stringify(m.headers ?? {}),
        body: m.body,
        interval_seconds: m.intervalSeconds,
        timeout_ms: m.timeoutMs,
        expected_status: m.expectedStatus,
        is_enabled: m.isEnabled ? 1 : 0,
        run_in_background: m.runInBackground ? 1 : 0,
        sort_order: (existingMonitors?.total ?? 0) + monitorRows.length,
        created_at: now,
        updated_at: now,
      });
    }

    // ----- One INSERT … SELECT FROM json_each(?) per table, in one transaction -----
    // Keeps the statement count constant no matter how large the file is
    // (D1 limits bound parameters per statement and queries per invocation).
    const statements: D1PreparedStatement[] = [];
    const bulkInsert = (table: string, rows: Record<string, unknown>[]) => {
      if (!rows.length) return;
      const columns = Object.keys(rows[0]);
      const select = columns.map((col) => `json_extract(value, '$.${col}')`).join(", ");
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) SELECT ${select} FROM json_each(?1)`
        ).bind(JSON.stringify(rows))
      );
    };
    bulkInsert("collections", collectionRows);
    bulkInsert("collection_folders", folderRows);
    bulkInsert("requests", requestRows);
    bulkInsert("environments", environmentRows);
    bulkInsert("environment_variables", variableRows);
    bulkInsert("monitors", monitorRows);

    if (statements.length) await c.env.DB.batch(statements);

    // Start background schedules for imported always-on monitors
    await Promise.all(
      monitorRows
        .filter((m) => m.run_in_background && m.is_enabled)
        .map((m) =>
          syncBackgroundScheduler(c.env, m.id as string, "sync").catch((err) =>
            console.error(`[Backup] scheduler sync failed: ${(err as Error).message}`)
          )
        )
    );

    const summary: ImportSummary = {
      collections: collectionRows.length,
      folders: folderRows.length,
      requests: requestRows.length,
      environments: environmentRows.length,
      monitors: monitorRows.length,
      skippedMonitors,
    };
    return c.json({ data: summary }, 201);
  }
);
