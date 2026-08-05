import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { collections, collectionFolders } from "./collections";

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id")
    .references(() => collections.id, { onDelete: "cascade" }),
  folderId: text("folder_id")
    .references(() => collectionFolders.id, { onDelete: "set null" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  method: text("method").notNull().default("GET"), // GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS
  url: text("url").notNull().default(""),
  headers: text("headers").default("[]"), // JSON array of { key, value, enabled }
  body: text("body"), // nullable — request body content
  bodyType: text("body_type").notNull().default("none"), // none|json|form-data|x-www-form-urlencoded|xml|text|binary|graphql
  queryParams: text("query_params").default("[]"), // JSON array of { key, value, enabled }
  authType: text("auth_type").notNull().default("none"), // none|bearer|basic|api-key|oauth2
  authConfig: text("auth_config").default("{}"), // JSON object for auth settings
  preRequestScript: text("pre_request_script"), // nullable
  testScript: text("test_script"), // nullable
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const requestHeaders = sqliteTable("request_headers", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull().default(""),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});
