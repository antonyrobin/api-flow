import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

/**
 * Create a Drizzle database client from a Cloudflare D1 binding.
 *
 * Usage in Hono route:
 * ```ts
 * const db = createDb(c.env.DB);
 * const users = await db.select().from(schema.users);
 * ```
 */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

// Re-export schema and types
export * from "./schema";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";
