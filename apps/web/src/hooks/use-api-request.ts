"use client";

import { useCallback } from "react";
import { useRequestStore } from "@/stores/request-store";
import { apiFetch } from "@/lib/api";
import type { ApiResponse } from "@api-flow/shared";

/**
 * Hook for executing API requests through the proxy.
 */
export function useApiRequest() {
  const {
    activeRequest,
    setResponse,
    setIsExecuting,
    setError,
  } = useRequestStore();

  const execute = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    setResponse(null);

    try {
      // Build headers object from key-value pairs
      const headers: Record<string, string> = {};
      activeRequest.headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => {
          headers[h.key] = h.value;
        });

      // Build URL with query params
      let url = activeRequest.url;
      const enabledParams = activeRequest.queryParams.filter(
        (p) => p.enabled && p.key
      );
      if (enabledParams.length > 0) {
        const searchParams = new URLSearchParams();
        enabledParams.forEach((p) => searchParams.append(p.key, p.value));
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}${searchParams.toString()}`;
      }

      // Add auth headers
      if (activeRequest.authType === "bearer" && activeRequest.authConfig.token) {
        headers["Authorization"] = `Bearer ${activeRequest.authConfig.token}`;
      } else if (activeRequest.authType === "basic") {
        const { username = "", password = "" } = activeRequest.authConfig;
        headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
      } else if (activeRequest.authType === "api-key" && activeRequest.authConfig.apiKeyName) {
        const location = activeRequest.authConfig.apiKeyLocation || "header";
        if (location === "header") {
          headers[activeRequest.authConfig.apiKeyName] =
            activeRequest.authConfig.apiKeyValue || "";
        } else {
          const separator = url.includes("?") ? "&" : "?";
          url = `${url}${separator}${activeRequest.authConfig.apiKeyName}=${activeRequest.authConfig.apiKeyValue || ""}`;
        }
      }

      const result = await apiFetch<{ data: ApiResponse }>("/proxy/execute", {
        method: "POST",
        body: JSON.stringify({
          method: activeRequest.method,
          url,
          headers,
          body: activeRequest.body,
          timeout: 30000,
        }),
      });

      setResponse(result.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to execute request";
      setError(message);
    } finally {
      setIsExecuting(false);
    }
  }, [activeRequest, setResponse, setIsExecuting, setError]);

  return { execute };
}
