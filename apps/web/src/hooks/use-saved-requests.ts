"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ApiRequest, AuthConfig, KeyValuePair } from "@api-flow/shared";
import type { AuthType, BodyType, HttpMethod } from "@api-flow/shared/constants";

/** Row shape returned by GET /requests (JSON columns are strings) */
export interface SavedRequestRow {
  id: string;
  collectionId: string | null;
  folderId: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: string | null;
  queryParams: string | null;
  body: string | null;
  bodyType: BodyType;
  authType: AuthType;
  authConfig: string | null;
  updatedAt: string;
}

export interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  folders: { id: string; name: string; parentFolderId: string | null }[];
}

export const SAVED_REQUESTS_KEY = ["saved-requests"];
export const COLLECTIONS_KEY = ["collections"];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToApiRequest(row: SavedRequestRow): ApiRequest {
  return {
    id: row.id,
    name: row.name,
    method: row.method,
    url: row.url,
    headers: parseJson<KeyValuePair[]>(row.headers, []),
    queryParams: parseJson<KeyValuePair[]>(row.queryParams, []),
    body: row.body,
    bodyType: row.bodyType,
    authType: row.authType,
    authConfig: parseJson<AuthConfig>(row.authConfig, {}),
  };
}

export function useSavedRequests(enabled: boolean) {
  return useQuery({
    queryKey: SAVED_REQUESTS_KEY,
    queryFn: () => apiFetch<{ data: SavedRequestRow[] }>("/requests").then((r) => r.data),
    enabled,
  });
}

export function useCollections(enabled: boolean) {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: () => apiFetch<{ data: CollectionRow[] }>("/collections").then((r) => r.data),
    enabled,
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_REQUESTS_KEY });
    },
  });
}

export function useSaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      request,
      includeCredentials,
    }: {
      id: string | null;
      request: ApiRequest;
      includeCredentials: boolean;
    }) => {
      const payload = {
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        queryParams: request.queryParams,
        body: request.body,
        bodyType: request.bodyType,
        authType: request.authType,
        // Secrets are only stored when the user explicitly opts in
        authConfig: includeCredentials ? request.authConfig : {},
      };
      const result = await apiFetch<{ data: { id: string } }>(id ? `/requests/${id}` : "/requests", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      return result.data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SAVED_REQUESTS_KEY }),
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/requests/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SAVED_REQUESTS_KEY }),
  });
}
