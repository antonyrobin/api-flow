"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownload, apiFetch } from "@/lib/api";
import type { Monitor, MonitorLog } from "@api-flow/shared";
import type { CreateMonitorInput, UpdateMonitorInput } from "@api-flow/shared/validators";

export const MONITORS_KEY = ["monitors"];
export const MONITOR_LOGS_KEY = ["monitor-logs"];

/** Logs kept in memory for the dashboard (sparklines, uptime, log viewer) */
const LOG_CACHE_SIZE = 500;
const MAX_IDS_PER_RUN = 25;

export function useMonitors(enabled: boolean) {
  return useQuery({
    queryKey: MONITORS_KEY,
    queryFn: () => apiFetch<{ data: Monitor[] }>("/monitors").then((r) => r.data),
    enabled,
    staleTime: Infinity,
  });
}

export function useMonitorLogs(enabled: boolean) {
  return useQuery({
    queryKey: MONITOR_LOGS_KEY,
    queryFn: () =>
      apiFetch<{ data: MonitorLog[] }>(`/monitors/logs?limit=${LOG_CACHE_SIZE}`).then((r) => r.data),
    enabled,
    staleTime: Infinity,
  });
}

export function useCreateMonitors() {
  const queryClient = useQueryClient();
  return useMutation({
    // Creates one or many monitors (bulk add)
    mutationFn: async (inputs: Partial<CreateMonitorInput>[]) => {
      const created: Monitor[] = [];
      const errors: string[] = [];
      for (const input of inputs) {
        try {
          const res = await apiFetch<{ data: Monitor }>("/monitors", {
            method: "POST",
            body: JSON.stringify(input),
          });
          created.push(res.data);
        } catch (err) {
          errors.push(`${input.url}: ${(err as Error).message}`);
        }
      }
      if (created.length === 0 && errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
      return { created, errors };
    },
    onSuccess: ({ created }) => {
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) => [...old, ...created]);
    },
  });
}

export function useUpdateMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMonitorInput }) =>
      apiFetch<{ data: Monitor }>(`/monitors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) =>
        old.map((m) => (m.id === updated.id ? { ...updated, lastCheck: m.lastCheck } : m))
      );
    },
  });
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/monitors/${id}`, { method: "DELETE" }).then(() => id),
    onSuccess: (id) => {
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) => old.filter((m) => m.id !== id));
      queryClient.setQueryData<MonitorLog[]>(MONITOR_LOGS_KEY, (old = []) =>
        old.filter((l) => l.monitorId !== id)
      );
    },
  });
}

export function useClearMonitorLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (monitorId: string | null) =>
      apiFetch(`/monitors/logs${monitorId ? `?monitorId=${encodeURIComponent(monitorId)}` : ""}`, {
        method: "DELETE",
      }).then(() => monitorId),
    onSuccess: (monitorId) => {
      queryClient.setQueryData<MonitorLog[]>(MONITOR_LOGS_KEY, (old = []) =>
        monitorId ? old.filter((l) => l.monitorId !== monitorId) : []
      );
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) =>
        old.map((m) => (!monitorId || m.id === monitorId ? { ...m, lastCheck: null } : m))
      );
    },
  });
}

export function downloadMonitorLogs(format: "csv" | "json", monitorId: string | null) {
  const params = new URLSearchParams({ format });
  if (monitorId) params.set("monitorId", monitorId);
  return apiDownload(`/monitors/logs/export?${params}`, `monitor-logs.${format}`);
}

/**
 * Keeps the dashboard fresh for monitors checked server-side.
 *
 * Background monitors are run by Durable Object alarms, not this page, so
 * their results only show up by re-reading the logs. Polls at the shortest
 * background interval (10–60 s) and patches each monitor's `lastCheck`.
 */
export function useBackgroundMonitorSync(monitors: Monitor[] | undefined) {
  const queryClient = useQueryClient();
  const intervals = (monitors ?? [])
    .filter((m) => m.isEnabled && m.runInBackground)
    .map((m) => m.intervalSeconds);
  const pollMs = intervals.length > 0 ? Math.min(Math.max(Math.min(...intervals), 10), 60) * 1000 : null;

  useEffect(() => {
    if (pollMs === null) return;

    const sync = async () => {
      const logs = await queryClient.fetchQuery({
        queryKey: MONITOR_LOGS_KEY,
        queryFn: () =>
          apiFetch<{ data: MonitorLog[] }>(`/monitors/logs?limit=${LOG_CACHE_SIZE}`).then((r) => r.data),
        staleTime: 0,
      });
      const latest = new Map<string, MonitorLog>();
      for (const log of logs) if (!latest.has(log.monitorId)) latest.set(log.monitorId, log);
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) =>
        old.map((m) => {
          const log = latest.get(m.id);
          return log && (!m.lastCheck || log.createdAt > m.lastCheck.createdAt) ? { ...m, lastCheck: log } : m;
        })
      );
    };

    const timer = window.setInterval(() => void sync().catch(() => {}), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, queryClient]);
}

/**
 * Client-side heartbeat scheduler.
 *
 * Every second it collects enabled monitors whose interval has elapsed and
 * runs them in one batched request (the API executes them in parallel).
 * Checks run while this page is open; browsers may slow timers in background tabs.
 * Monitors with `runInBackground` are skipped — their Durable Object checks them.
 */
export function useMonitorRunner(monitors: Monitor[] | undefined, running: boolean) {
  const queryClient = useQueryClient();
  const nextDueRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const applyResults = useCallback(
    (logs: MonitorLog[]) => {
      if (logs.length === 0) return;
      queryClient.setQueryData<MonitorLog[]>(MONITOR_LOGS_KEY, (old = []) =>
        [...logs, ...old]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, LOG_CACHE_SIZE)
      );
      const byId = new Map(logs.map((l) => [l.monitorId, l]));
      queryClient.setQueryData<Monitor[]>(MONITORS_KEY, (old = []) =>
        old.map((m) => (byId.has(m.id) ? { ...m, lastCheck: byId.get(m.id) } : m))
      );
    },
    [queryClient]
  );

  const runChecks = useCallback(
    async (ids: string[]) => {
      const fresh = ids.filter((id) => !inFlightRef.current.has(id));
      if (fresh.length === 0) return;

      fresh.forEach((id) => inFlightRef.current.add(id));
      setInFlight(new Set(inFlightRef.current));

      try {
        for (let i = 0; i < fresh.length; i += MAX_IDS_PER_RUN) {
          const chunk = fresh.slice(i, i + MAX_IDS_PER_RUN);
          const res = await apiFetch<{ data: MonitorLog[] }>("/monitors/run", {
            method: "POST",
            body: JSON.stringify({ ids: chunk }),
          });
          applyResults(res.data);
        }
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        const now = Date.now();
        const byId = new Map((monitors ?? []).map((m) => [m.id, m]));
        fresh.forEach((id) => {
          inFlightRef.current.delete(id);
          const monitor = byId.get(id);
          if (monitor) nextDueRef.current.set(id, now + monitor.intervalSeconds * 1000);
        });
        setInFlight(new Set(inFlightRef.current));
      }
    },
    [applyResults, monitors]
  );

  // Start: run every enabled monitor immediately, then on its own interval
  useEffect(() => {
    if (!running || !monitors) return;

    const tick = () => {
      const now = Date.now();
      const due = monitors
        .filter((m) => m.isEnabled && !m.runInBackground)
        .filter((m) => (nextDueRef.current.get(m.id) ?? 0) <= now)
        .map((m) => m.id);
      if (due.length > 0) void runChecks(due);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [running, monitors, runChecks]);

  // When stopped, forget schedule so the next start checks everything immediately
  useEffect(() => {
    if (!running) nextDueRef.current.clear();
  }, [running]);

  const getNextDue = useCallback((id: string) => nextDueRef.current.get(id) ?? null, []);

  return { runChecks, inFlight, error, clearError: () => setError(null), getNextDue };
}
