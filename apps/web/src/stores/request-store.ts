"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ApiRequest,
  ApiResponse,
  KeyValuePair,
  AuthConfig,
} from "@api-flow/shared";
import type { HttpMethod, BodyType, AuthType } from "@api-flow/shared/constants";
import { nanoid } from "@api-flow/shared";

/**
 * One open request tab. The active tab's live state is mirrored in the
 * top-level `active*` fields (what the editors read and write); other tabs
 * keep a snapshot here until they are activated again.
 */
export interface RequestTab {
  id: string;
  request: ApiRequest;
  savedRequestId: string | null;
  response: ApiResponse | null;
  error: string | null;
  isExecuting: boolean;
  /** Edited since it was opened / last saved */
  dirty: boolean;
}

export const MAX_TABS = 30;

interface RequestStore {
  // ----- Tabs -----
  tabs: RequestTab[];
  activeTabId: string;

  // ----- Active tab (live) -----
  // Current request being edited
  activeRequest: ApiRequest;
  // Server id when the active request was loaded from / saved to the account
  savedRequestId: string | null;
  // Response from the last execution
  activeResponse: ApiResponse | null;
  // Loading state
  isExecuting: boolean;
  // Error state
  error: string | null;
  dirty: boolean;

  // Tab actions
  newTab: (request?: ApiRequest, savedRequestId?: string | null) => void;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  /** Focus the tab already showing this saved request, or open it (reusing an empty tab) */
  openSavedRequest: (request: ApiRequest, savedRequestId: string) => void;
  /** Deliver an execution result to the tab that started it (it may no longer be active) */
  setTabResult: (
    tabId: string,
    result: Partial<Pick<RequestTab, "response" | "error" | "isExecuting">>
  ) => void;
  /** A saved request was deleted — keep its open tabs but mark them unsaved */
  detachSavedRequest: (savedRequestId: string) => void;

  // Editor actions (active tab)
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
  loadRequest: (request: ApiRequest, savedRequestId?: string | null) => void;
  setSavedRequestId: (id: string | null) => void;
  resetRequest: () => void;
}

function defaultHeaders(): KeyValuePair[] {
  return [
    { id: nanoid(), key: "Accept", value: "application/json", enabled: true },
    { id: nanoid(), key: "Content-Type", value: "application/json", enabled: true },
  ];
}

function newRequest(): ApiRequest {
  return {
    id: nanoid(),
    name: "Untitled Request",
    method: "GET",
    url: "",
    headers: defaultHeaders(),
    queryParams: [],
    body: null,
    bodyType: "none",
    authType: "none",
    authConfig: {},
  };
}

function makeTab(request: ApiRequest = newRequest(), savedRequestId: string | null = null): RequestTab {
  return {
    id: nanoid(),
    request,
    savedRequestId,
    response: null,
    error: null,
    isExecuting: false,
    dirty: false,
  };
}

type State = RequestStore;

/** Fields of the active tab as top-level state */
function activate(tab: RequestTab): Partial<State> {
  return {
    activeTabId: tab.id,
    activeRequest: tab.request,
    savedRequestId: tab.savedRequestId,
    activeResponse: tab.response,
    error: tab.error,
    isExecuting: tab.isExecuting,
    dirty: tab.dirty,
  };
}

/** All tabs with the active one refreshed from the live top-level fields */
export function snapshotTabs(state: State): RequestTab[] {
  return state.tabs.map((t) =>
    t.id === state.activeTabId
      ? {
          ...t,
          request: state.activeRequest,
          savedRequestId: state.savedRequestId,
          response: state.activeResponse,
          error: state.error,
          isExecuting: state.isExecuting,
          dirty: state.dirty,
        }
      : t
  );
}

/** A tab nobody has typed into yet — safe to reuse */
function isPristine(state: State) {
  return !state.activeRequest.url.trim() && !state.savedRequestId && !state.dirty;
}

const initialTab = makeTab();

/**
 * localStorage, written at most every 400 ms (the store changes on every keystroke)
 * and tolerant of quota / private-mode errors.
 */
function debouncedLocalStorage() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { name: string; value: string } | null = null;
  const flush = () => {
    if (!pending) return;
    try {
      localStorage.setItem(pending.name, pending.value);
    } catch {
      /* storage full or unavailable — tabs just won't persist */
    }
    pending = null;
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
  return {
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      pending = { name, value };
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export const useRequestStore = create<RequestStore>()(
  persist(
    (set) => {
      /** Update the active request and mark the tab edited */
      const edit = (fn: (request: ApiRequest) => ApiRequest) =>
        set((state) => ({ activeRequest: fn(state.activeRequest), dirty: true }));

      return {
        tabs: [initialTab],
        ...(activate(initialTab) as Pick<
          State,
          "activeTabId" | "activeRequest" | "savedRequestId" | "activeResponse" | "error" | "isExecuting" | "dirty"
        >),

        // ============ Tabs ============

        newTab: (request, savedRequestId = null) =>
          set((state) => {
            const tabs = snapshotTabs(state);
            const tab = makeTab(request ? { ...request } : newRequest(), savedRequestId);
            // Drop the oldest untouched tabs when over the limit
            while (tabs.length >= MAX_TABS) {
              const idx = tabs.findIndex((t) => !t.dirty && !t.isExecuting);
              tabs.splice(idx === -1 ? 0 : idx, 1);
            }
            return { tabs: [...tabs, tab], ...activate(tab) };
          }),

        switchTab: (tabId) =>
          set((state) => {
            if (tabId === state.activeTabId) return {};
            const tabs = snapshotTabs(state);
            const tab = tabs.find((t) => t.id === tabId);
            return tab ? { tabs, ...activate(tab) } : {};
          }),

        closeTab: (tabId) =>
          set((state) => {
            const tabs = snapshotTabs(state);
            const index = tabs.findIndex((t) => t.id === tabId);
            if (index === -1) return {};
            const remaining = tabs.filter((t) => t.id !== tabId);
            if (remaining.length === 0) {
              const tab = makeTab();
              return { tabs: [tab], ...activate(tab) };
            }
            if (tabId !== state.activeTabId) return { tabs: remaining };
            const next = remaining[Math.min(index, remaining.length - 1)];
            return { tabs: remaining, ...activate(next) };
          }),

        closeOtherTabs: (tabId) =>
          set((state) => {
            const tab = snapshotTabs(state).find((t) => t.id === tabId);
            return tab ? { tabs: [tab], ...activate(tab) } : {};
          }),

        duplicateTab: (tabId) =>
          set((state) => {
            const tabs = snapshotTabs(state);
            const source = tabs.find((t) => t.id === tabId);
            if (!source || tabs.length >= MAX_TABS) return {};
            const copy = makeTab(
              { ...structuredClone(source.request), id: nanoid(), name: `${source.request.name} copy` },
              null
            );
            copy.dirty = true;
            const index = tabs.indexOf(source);
            return { tabs: [...tabs.slice(0, index + 1), copy, ...tabs.slice(index + 1)], ...activate(copy) };
          }),

        openSavedRequest: (request, savedRequestId) =>
          set((state) => {
            const tabs = snapshotTabs(state);
            const existing = tabs.find((t) => t.savedRequestId === savedRequestId);
            if (existing) return { tabs, ...activate(existing) };
            if (isPristine(state)) {
              const tab = { ...makeTab(request, savedRequestId), id: state.activeTabId };
              return { tabs: tabs.map((t) => (t.id === tab.id ? tab : t)), ...activate(tab) };
            }
            const tab = makeTab(request, savedRequestId);
            return { tabs: [...tabs, tab].slice(-MAX_TABS), ...activate(tab) };
          }),

        setTabResult: (tabId, result) =>
          set((state) => {
            if (tabId === state.activeTabId) {
              return {
                ...(result.response !== undefined && { activeResponse: result.response }),
                ...(result.error !== undefined && { error: result.error }),
                ...(result.isExecuting !== undefined && { isExecuting: result.isExecuting }),
              };
            }
            return { tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...result } : t)) };
          }),

        detachSavedRequest: (savedRequestId) =>
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.savedRequestId === savedRequestId ? { ...t, savedRequestId: null, dirty: true } : t
            ),
            ...(state.savedRequestId === savedRequestId && { savedRequestId: null, dirty: true }),
          })),

        // ============ Editor ============

        setMethod: (method) => edit((r) => ({ ...r, method })),
        setUrl: (url) => edit((r) => ({ ...r, url })),
        setName: (name) => edit((r) => ({ ...r, name })),
        setHeaders: (headers) => edit((r) => ({ ...r, headers })),

        addHeader: () =>
          edit((r) => ({
            ...r,
            headers: [...r.headers, { id: nanoid(), key: "", value: "", enabled: true }],
          })),

        removeHeader: (id) => edit((r) => ({ ...r, headers: r.headers.filter((h) => h.id !== id) })),

        toggleHeader: (id) =>
          edit((r) => ({
            ...r,
            headers: r.headers.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h)),
          })),

        setQueryParams: (queryParams) => edit((r) => ({ ...r, queryParams })),

        addQueryParam: () =>
          edit((r) => ({
            ...r,
            queryParams: [...r.queryParams, { id: nanoid(), key: "", value: "", enabled: true }],
          })),

        removeQueryParam: (id) =>
          edit((r) => ({ ...r, queryParams: r.queryParams.filter((p) => p.id !== id) })),

        toggleQueryParam: (id) =>
          edit((r) => ({
            ...r,
            queryParams: r.queryParams.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
          })),

        setBody: (body) => edit((r) => ({ ...r, body })),
        setBodyType: (bodyType) => edit((r) => ({ ...r, bodyType })),
        setAuthType: (authType) => edit((r) => ({ ...r, authType })),
        setAuthConfig: (authConfig) => edit((r) => ({ ...r, authConfig })),

        setResponse: (response) => set({ activeResponse: response }),
        setIsExecuting: (isExecuting) => set({ isExecuting }),
        setError: (error) => set({ error }),

        loadRequest: (request, savedRequestId = null) =>
          set({
            activeRequest: request,
            savedRequestId,
            activeResponse: null,
            error: null,
            dirty: false,
          }),

        // Saving clears the edited marker
        setSavedRequestId: (savedRequestId) => set({ savedRequestId, dirty: false }),

        resetRequest: () =>
          set({
            activeRequest: newRequest(),
            savedRequestId: null,
            activeResponse: null,
            error: null,
            dirty: false,
          }),
      };
    },
    {
      // Open tabs survive reloads and the sign-in round trip (guests included).
      // Responses aren't stored — they can be large and may contain sensitive data.
      name: "apiflow-tabs",
      version: 1,
      storage: createJSONStorage(debouncedLocalStorage),
      skipHydration: true,
      partialize: (state) => ({
        activeTabId: state.activeTabId,
        tabs: snapshotTabs(state).map((t) => ({
          ...t,
          response: null,
          error: null,
          isExecuting: false,
        })),
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Pick<State, "tabs" | "activeTabId">> | undefined;
        if (!saved?.tabs?.length) return current;
        const active = saved.tabs.find((t) => t.id === saved.activeTabId) ?? saved.tabs[0];
        return { ...current, tabs: saved.tabs, ...activate(active) };
      },
    }
  )
);
