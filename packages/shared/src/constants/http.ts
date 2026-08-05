// ============================================
// HTTP Constants
// ============================================

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = [
  "none",
  "json",
  "form-data",
  "x-www-form-urlencoded",
  "xml",
  "text",
  "binary",
  "graphql",
] as const;

export type BodyType = (typeof BODY_TYPES)[number];

export const AUTH_TYPES = [
  "none",
  "bearer",
  "basic",
  "api-key",
  "oauth2",
] as const;

export type AuthType = (typeof AUTH_TYPES)[number];

/** Methods that typically carry a request body */
export const METHODS_WITH_BODY: HttpMethod[] = ["POST", "PUT", "PATCH"];

/** HTTP method display colors (for UI theming) */
export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22c55e",    // green
  POST: "#3b82f6",   // blue
  PUT: "#f59e0b",    // amber
  PATCH: "#a855f7",  // purple
  DELETE: "#ef4444",  // red
  HEAD: "#06b6d4",   // cyan
  OPTIONS: "#6b7280", // gray
};

/** Status code range classifications */
export const STATUS_CATEGORIES = {
  info: { min: 100, max: 199, label: "Informational", color: "#94a3b8" },
  success: { min: 200, max: 299, label: "Success", color: "#22c55e" },
  redirect: { min: 300, max: 399, label: "Redirect", color: "#3b82f6" },
  clientError: { min: 400, max: 499, label: "Client Error", color: "#f59e0b" },
  serverError: { min: 500, max: 599, label: "Server Error", color: "#ef4444" },
} as const;

/** Common default headers */
export const DEFAULT_HEADERS = [
  { key: "Content-Type", value: "application/json" },
  { key: "Accept", value: "application/json" },
  { key: "User-Agent", value: "API-Flow/1.0" },
] as const;

/** Common content types for the body type selector */
export const CONTENT_TYPE_MAP: Record<string, string> = {
  json: "application/json",
  "form-data": "multipart/form-data",
  "x-www-form-urlencoded": "application/x-www-form-urlencoded",
  xml: "application/xml",
  text: "text/plain",
  graphql: "application/json",
};
