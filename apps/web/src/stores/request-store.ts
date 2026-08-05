"use client";

import { create } from "zustand";
import type {
  ApiRequest,
  ApiResponse,
  KeyValuePair,
  AuthConfig,
} from "@api-flow/shared";
import type { HttpMethod, BodyType, AuthType } from "@api-flow/shared/constants";
import { nanoid } from "@api-flow/shared";

interface RequestStore {
  // Current request being edited
  activeRequest: ApiRequest;
  // Response from the last execution
  activeResponse: ApiResponse | null;
  // Loading state
  isExecuting: boolean;
  // Error state
  error: string | null;

  // Actions
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setName: (name: string) => void;
  setHeaders: (headers: KeyValuePair[]) => void;
  addHeader: () => void;
  removeHeader: (id: string) => void;
  toggleHeader: (id: string) => void;
  setQueryParams: (params: KeyValuePair[]) => void;
  addQueryParam: () => void;
  removeQueryParam: (id: string) => void;
  toggleQueryParam: (id: string) => void;
  setBody: (body: string | null) => void;
  setBodyType: (bodyType: BodyType) => void;
  setAuthType: (authType: AuthType) => void;
  setAuthConfig: (config: AuthConfig) => void;
  setResponse: (response: ApiResponse | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setError: (error: string | null) => void;
  loadRequest: (request: ApiRequest) => void;
  resetRequest: () => void;
}

const defaultRequest: ApiRequest = {
  id: "",
  name: "Untitled Request",
  method: "GET",
  url: "",
  headers: [
    {
      id: nanoid(),
      key: "Content-Type",
      value: "application/json",
      enabled: true,
    },
    { id: nanoid(), key: "Accept", value: "application/json", enabled: true },
  ],
  queryParams: [],
  body: null,
  bodyType: "none",
  authType: "none",
  authConfig: {},
};

export const useRequestStore = create<RequestStore>((set) => ({
  activeRequest: { ...defaultRequest, id: nanoid() },
  activeResponse: null,
  isExecuting: false,
  error: null,

  setMethod: (method) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, method },
    })),

  setUrl: (url) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, url },
    })),

  setName: (name) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, name },
    })),

  setHeaders: (headers) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, headers },
    })),

  addHeader: () =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        headers: [
          ...state.activeRequest.headers,
          { id: nanoid(), key: "", value: "", enabled: true },
        ],
      },
    })),

  removeHeader: (id) =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        headers: state.activeRequest.headers.filter((h) => h.id !== id),
      },
    })),

  toggleHeader: (id) =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        headers: state.activeRequest.headers.map((h) =>
          h.id === id ? { ...h, enabled: !h.enabled } : h
        ),
      },
    })),

  setQueryParams: (params) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, queryParams: params },
    })),

  addQueryParam: () =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        queryParams: [
          ...state.activeRequest.queryParams,
          { id: nanoid(), key: "", value: "", enabled: true },
        ],
      },
    })),

  removeQueryParam: (id) =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        queryParams: state.activeRequest.queryParams.filter((p) => p.id !== id),
      },
    })),

  toggleQueryParam: (id) =>
    set((state) => ({
      activeRequest: {
        ...state.activeRequest,
        queryParams: state.activeRequest.queryParams.map((p) =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        ),
      },
    })),

  setBody: (body) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, body },
    })),

  setBodyType: (bodyType) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, bodyType },
    })),

  setAuthType: (authType) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, authType },
    })),

  setAuthConfig: (authConfig) =>
    set((state) => ({
      activeRequest: { ...state.activeRequest, authConfig },
    })),

  setResponse: (response) => set({ activeResponse: response }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setError: (error) => set({ error }),

  loadRequest: (request) =>
    set({
      activeRequest: request,
      activeResponse: null,
      error: null,
    }),

  resetRequest: () =>
    set({
      activeRequest: { ...defaultRequest, id: nanoid() },
      activeResponse: null,
      error: null,
    }),
}));
