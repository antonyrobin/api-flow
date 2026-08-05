import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { requests } from "./requests";
import { schedules } from "./schedules";

/**
 * Request execution history — stores minimal tracking data.
 * Full response bodies are NOT stored (per user decision).
 */
export const requestHistory = sqliteTable("request_history", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .references(() => requests.id, { onDelete: "set null" }),
  userId: text("user_id"), // nullable — guests don't have user IDs
  method: text("method").notNull(),
  url: text("url").notNull(),
  statusCode: integer("status_code"),
  responseSizeBytes: integer("response_size_bytes"),
  // Timing breakdown (milliseconds)
  timingDnsMs: integer("timing_dns_ms"),
  timingTcpMs: integer("timing_tcp_ms"),
  timingTlsMs: integer("timing_tls_ms"),
  timingTtfbMs: integer("timing_ttfb_ms"),
  timingTotalMs: integer("timing_total_ms"),
  // Error tracking
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

/**
 * Schedule execution logs — tracks each run of a scheduled API call.
 */
export const scheduleLogs = sqliteTable("schedule_logs", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  statusCode: integer("status_code"),
  timingTotalMs: integer("timing_total_ms"),
  isSuccess: integer("is_success", { mode: "boolean" }).notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});
