import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { requests } from "./requests";

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    cronExpression: text("cron_expression"), // nullable — alternative to interval
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastRunAt: text("last_run_at"), // nullable — ISO timestamp
    nextRunAt: text("next_run_at"), // nullable — ISO timestamp
    durableObjectId: text("durable_object_id"), // nullable — Cloudflare DO ID
    maxRetries: integer("max_retries").notNull().default(3),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("schedules_user_idx").on(t.userId), index("schedules_request_idx").on(t.requestId)]
);
