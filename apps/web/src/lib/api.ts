import { hc } from "hono/client";
import type { AppType } from "@api-flow/api";
import { API_URL } from "./config";

/**
 * Hono RPC client — provides end-to-end type safety.
 *
 * All API calls through this client are fully typed,
 * matching the Hono routes defined in apps/api.
 */
export const api = hc<AppType>(API_URL, {
  headers: () => {
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
});

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Direct fetch wrapper for API calls that don't use Hono RPC.
 * Sends the session cookie and normalises error responses.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the API Flow server. Check your connection and try again.",
      0
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message =
      (error as { error?: { message?: string } })?.error?.message ||
      (response.status === 401
        ? "Please sign in to continue."
        : `API error: ${response.status}`);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * Download a file from the API (uses the session cookie) and save it.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(`Download failed (${response.status})`, response.status);
  }

  const disposition = response.headers.get("content-disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
