"use client";

import { useCallback } from "react";
import { useRequestStore } from "@/stores/request-store";
import { apiFetch } from "@/lib/api";
import { METHODS_WITH_BODY } from "@api-flow/shared/constants";
import type { ApiRequest, ApiResponse } from "@api-flow/shared";

interface ProxyResult extends Omit<ApiResponse, "statusCode" | "statusText"> {
  statusCode?: number;
  statusText?: string;
  error?: string;
}

/**
 * Build the final URL + headers for a request (query params and auth applied).
 */
export function buildOutgoingRequest(request: ApiRequest) {
  const headers: Record<string, string> = {};
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headers[h.key.trim()] = h.value;
    });

  let url = request.url.trim();
  if (url && !/^[a-z][a-z\d+.-]*:\/\//i.test(url)) {
    // Allow "api.example.com/users" — default to https
    url = `https://${url}`;
  }

  const searchParams = new URLSearchParams();
  request.queryParams
    .filter((p) => p.enabled && p.key.trim())
    .forEach((p) => searchParams.append(p.key.trim(), p.value));

  const { authType, authConfig } = request;
  if (authType === "bearer" && authConfig.token) {
    headers["Authorization"] = `Bearer ${authConfig.token}`;
  } else if (authType === "basic" && (authConfig.username || authConfig.password)) {
    const raw = `${authConfig.username || ""}:${authConfig.password || ""}`;
    // btoa only handles Latin-1; encode as UTF-8 first
    headers["Authorization"] = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(raw)))}`;
  } else if (authType === "api-key" && authConfig.apiKeyName) {
    if ((authConfig.apiKeyLocation || "header") === "header") {
      headers[authConfig.apiKeyName] = authConfig.apiKeyValue || "";
    } else {
      searchParams.append(authConfig.apiKeyName, authConfig.apiKeyValue || "");
    }
  }

  const query = searchParams.toString();
  if (query) {
    url = `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }

  const sendBody =
    request.bodyType !== "none" &&
    !!request.body &&
    (METHODS_WITH_BODY as string[]).concat("DELETE").includes(request.method);

  if (!sendBody) {
    // Don't advertise a body that isn't sent
    delete headers["Content-Type"];
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-type") delete headers[key];
    }
  }

  return { url, headers, body: sendBody ? request.body : null };
}

/**
 * Hook for executing API requests through the proxy.
 * Works for guests — no account needed to test an API.
 */
export function useApiRequest() {
  const { activeRequest, activeTabId, setTabResult } = useRequestStore();

  const execute = useCallback(async () => {
    // Results go back to the tab that sent the request, even if the user switches tabs
    const tabId = activeTabId;
    setTabResult(tabId, { isExecuting: true, error: null, response: null });

    try {
      const { url, headers, body } = buildOutgoingRequest(activeRequest);

      const result = await apiFetch<{ data: ProxyResult }>("/proxy/execute", {
        method: "POST",
        body: JSON.stringify({
          method: activeRequest.method,
          url,
          headers,
          body,
          timeout: 30000,
        }),
      });

      if (result.data.error || result.data.statusCode === undefined) {
        setTabResult(tabId, { error: result.data.error || "The request failed without a response" });
        return;
      }

      setTabResult(tabId, {
        response: {
          ...result.data,
          statusCode: result.data.statusCode,
          statusText: result.data.statusText || "",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to execute request";
      setTabResult(tabId, { error: message });
    } finally {
      setTabResult(tabId, { isExecuting: false });
    }
  }, [activeRequest, activeTabId, setTabResult]);

  return { execute };
}
