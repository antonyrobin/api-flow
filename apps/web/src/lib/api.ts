import { hc } from "hono/client";
import type { AppType } from "@api-flow/api";

/**
 * Hono RPC client — provides end-to-end type safety.
 *
 * All API calls through this client are fully typed,
 * matching the Hono routes defined in apps/api.
 */
export const api = hc<AppType>(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787",
  {
    headers: () => {
      // Forward cookies for session authentication
      return {
        "Content-Type": "application/json",
      };
    },
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        credentials: "include", // Include cookies for auth
      });
    },
  }
);

/**
 * Direct fetch wrapper for API calls that don't use Hono RPC.
 * Used for Better Auth endpoints and file uploads.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        `API error: ${response.status}`
    );
  }

  return response.json();
}
