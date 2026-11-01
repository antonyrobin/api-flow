import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Health-check monitors — endpoints a user pings on an interval
 * from the Monitors screen (heartbeat / uptime checks), or in the
 * background via MonitorSchedulerDO when `runInBackground` is set.
 */
export const monitors = sqliteTable(
  "monitors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    method: text("method").notNull().default("GET"),
    url: text("url").notNull(),
    headers: text("headers").default("{}"), // JSON object { name: value }
    body: text("body"),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    timeoutMs: integer("timeout_ms").notNull().default(10000),
    // null = any 2xx/3xx counts as healthy
    expectedStatus: integer("expected_status"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    // true = checked by MonitorSchedulerDO alarms, even with the dashboard closed
    runInBackground: integer("run_in_background", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("monitors_user_idx").on(table.userId)]
);

/**
 * One row per health check execution.
 */
export const monitorLogs = sqliteTable(
  "monitor_logs",
  {
    id: text("id").primaryKey(),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    isSuccess: integer("is_success", { mode: "boolean" }).notNull(),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("monitor_logs_monitor_created_idx").on(table.monitorId, table.createdAt),
    index("monitor_logs_user_created_idx").on(table.userId, table.createdAt),
  ]
);
