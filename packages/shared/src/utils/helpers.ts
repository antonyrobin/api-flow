import { nanoid } from "../utils";

/**
 * Generate a unique ID for entities.
 * Uses nanoid for URL-safe, compact identifiers.
 */
export { nanoid as generateId };

/**
 * Get the current ISO timestamp string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Resolve variables in a string template.
 * Replaces {{variableName}} with values from the variables map.
 *
 * @example
 * resolveVariables("{{base_url}}/users", { base_url: "https://api.example.com" })
 * // => "https://api.example.com/users"
 */
export function resolveVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Parse a URL to separate the base URL and query parameters.
 */
export function parseUrl(rawUrl: string): {
  baseUrl: string;
  params: Array<{ key: string; value: string }>;
} {
  try {
    const url = new URL(rawUrl);
    const params: Array<{ key: string; value: string }> = [];
    url.searchParams.forEach((value: string, key: string) => {
      params.push({ key, value });
    });
    return {
      baseUrl: `${url.origin}${url.pathname}`,
      params,
    };
  } catch {
    return { baseUrl: rawUrl, params: [] };
  }
}

/**
 * Format bytes to a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format milliseconds to a human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

/**
 * Get status code category label and color.
 */
export function getStatusInfo(statusCode: number): {
  label: string;
  color: string;
  category: "info" | "success" | "redirect" | "clientError" | "serverError";
} {
  if (statusCode >= 100 && statusCode < 200)
    return { label: "Info", color: "#94a3b8", category: "info" };
  if (statusCode >= 200 && statusCode < 300)
    return { label: "Success", color: "#22c55e", category: "success" };
  if (statusCode >= 300 && statusCode < 400)
    return { label: "Redirect", color: "#3b82f6", category: "redirect" };
  if (statusCode >= 400 && statusCode < 500)
    return { label: "Client Error", color: "#f59e0b", category: "clientError" };
  return { label: "Server Error", color: "#ef4444", category: "serverError" };
}

const STATUS_TEXTS: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/**
 * Get the standard HTTP reason phrase for a status code.
 */
export function getStatusText(code: number): string {
  return STATUS_TEXTS[code] || "Unknown";
}
