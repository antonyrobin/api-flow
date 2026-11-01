"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { formatDuration } from "@api-flow/shared";
import type { Monitor, MonitorLog } from "@api-flow/shared";
import { AppShell } from "@/components/layout/AppShell";
import {
  MONITOR_LOGS_KEY,
  downloadMonitorLogs,
  useClearMonitorLogs,
  useCreateMonitors,
  useDeleteMonitor,
  useBackgroundMonitorSync,
  useMonitorLogs,
  useMonitorRunner,
  useMonitors,
  useUpdateMonitor,
} from "@/hooks/use-monitors";
import { MonitorCard, monitorState } from "./MonitorCard";
import { MonitorFormDialog } from "./MonitorFormDialog";
import { MonitorLogsPanel } from "./MonitorLogsPanel";

const RUNNING_KEY = "api-flow:monitors-running";

function readRunningPreference(): boolean {
  try {
    return window.localStorage.getItem(RUNNING_KEY) !== "false";
  } catch {
    return true;
  }
}

export function MonitorsDashboard() {
  const { data: session, isPending } = useSession();

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
          {isPending ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" aria-label="Loading" />
            </div>
          ) : !session ? (
            <SignInRequired />
          ) : (
            <Dashboard />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SignInRequired() {
  return (
    <div className="max-w-lg mx-auto text-center glass-card p-8 sm:p-10 mt-6 sm:mt-12">
      <div className="w-14 h-14 rounded-2xl bg-brand-600/15 flex items-center justify-center mx-auto mb-5">
        <Lock className="w-6 h-6 text-brand-300" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-gray-100 mb-2">Monitor your APIs</h1>
      <p className="text-sm text-gray-400 mb-6">
        Add multiple endpoints, check them on your own interval like a heartbeat, and view,
        download or clear the logs. Monitors are saved to your account, so sign in or create a free
        account to continue. Testing single requests in the workspace stays free without an account.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/login?next=/monitors" className="btn-secondary text-sm">
          Sign in
        </Link>
        <Link href="/register?next=/monitors" className="btn-primary text-sm">
          Create free account
        </Link>
      </div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const monitorsQuery = useMonitors(true);
  const logsQuery = useMonitorLogs(true);
  const createMonitors = useCreateMonitors();
  const updateMonitor = useUpdateMonitor();
  const deleteMonitor = useDeleteMonitor();
  const clearLogs = useClearMonitorLogs();

  const monitors = monitorsQuery.data;
  const logs = logsQuery.data ?? [];

  const [running, setRunning] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Monitor | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const runner = useMonitorRunner(monitors, running);
  useBackgroundMonitorSync(monitors);

  // Restore the start/pause preference after mount (avoids hydration mismatch)
  useEffect(() => setRunning(readRunningPreference()), []);

  const toggleRunning = () => {
    const next = !running;
    setRunning(next);
    try {
      window.localStorage.setItem(RUNNING_KEY, String(next));
    } catch {
      // storage unavailable — preference just isn't remembered
    }
  };

  // Re-render relative timestamps
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const historyByMonitor = useMemo(() => {
    const map = new Map<string, MonitorLog[]>();
    for (const log of logs) {
      const list = map.get(log.monitorId) ?? [];
      list.push(log);
      map.set(log.monitorId, list);
    }
    return map;
  }, [logs]);

  const stats = useMemo(() => {
    const list = monitors ?? [];
    const states = list.map(monitorState);
    const times = list
      .map((m) => m.lastCheck?.responseTimeMs)
      .filter((t): t is number => typeof t === "number");
    return {
      total: list.length,
      up: states.filter((s) => s === "up").length,
      down: states.filter((s) => s === "down").length,
      paused: states.filter((s) => s === "paused").length,
      avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    };
  }, [monitors]);

  const enabledIds = (monitors ?? []).filter((m) => m.isEnabled).map((m) => m.id);
  // Only these depend on the page's start/pause control; background ones run server-side
  const browserIds = (monitors ?? []).filter((m) => m.isEnabled && !m.runInBackground).map((m) => m.id);

  const openCreate = () => {
    setEditing(null);
    createMonitors.reset();
    updateMonitor.reset();
    setFormOpen(true);
  };

  const handleSubmit = (inputs: Parameters<typeof createMonitors.mutate>[0]) => {
    if (editing) {
      updateMonitor.mutate(
        { id: editing.id, input: inputs[0]! },
        { onSuccess: () => setFormOpen(false) }
      );
      return;
    }
    createMonitors.mutate(inputs, {
      onSuccess: ({ created, errors }) => {
        setFormOpen(false);
        if (errors.length > 0) {
          setNotice(`Added ${created.length}, skipped ${errors.length}:\n${errors.join("\n")}`);
        }
        // Check new monitors straight away when monitoring is running
        if (running) {
          void runner.runChecks(created.filter((m) => m.isEnabled && !m.runInBackground).map((m) => m.id));
        }
      },
    });
  };

  const handleDownload = async (format: "csv" | "json") => {
    setIsDownloading(true);
    try {
      await downloadMonitorLogs(format, logFilter);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClear = () => {
    const target = logFilter ? monitors?.find((m) => m.id === logFilter)?.name : null;
    const message = target
      ? `Clear all logs for "${target}"? This cannot be undone.`
      : "Clear logs for ALL monitors? This cannot be undone.";
    if (window.confirm(message)) clearLogs.mutate(logFilter);
  };

  const formError =
    (editing ? (updateMonitor.error as Error | null) : (createMonitors.error as Error | null))?.message ?? null;

  return (
    <>
      {/* ===== Page header ===== */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-400" aria-hidden />
            Endpoint monitors
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Heartbeat checks for multiple APIs at once. Checks run while this page is open, or
            around the clock for monitors set to run in the background.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:ml-auto">
          <button
            type="button"
            onClick={toggleRunning}
            disabled={browserIds.length === 0}
            className={cn(
              "flex items-center gap-2 text-sm disabled:opacity-50",
              running ? "btn-secondary" : "btn-primary"
            )}
            aria-pressed={running}
          >
            {running ? <Pause className="w-4 h-4" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
            {running ? "Pause monitoring" : "Start monitoring"}
          </button>
          <button
            type="button"
            onClick={() => runner.runChecks(enabledIds)}
            disabled={enabledIds.length === 0 || runner.inFlight.size > 0}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", runner.inFlight.size > 0 && "animate-spin")} aria-hidden />
            Check all now
          </button>
          <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" aria-hidden />
            Add endpoints
          </button>
        </div>
      </div>

      {/* ===== Alerts ===== */}
      {(runner.error || notice) && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <p className="flex-1 whitespace-pre-line break-words">{runner.error || notice}</p>
          <button
            type="button"
            onClick={() => {
              runner.clearError();
              setNotice(null);
            }}
            aria-label="Dismiss"
            className="p-0.5 rounded hover:bg-amber-500/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===== Summary ===== */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryTile label="Monitors" value={stats.total} sub={stats.paused ? `${stats.paused} paused` : running ? "Monitoring" : "Paused"} />
        <SummaryTile label="Up" value={stats.up} tone="up" />
        <SummaryTile label="Down" value={stats.down} tone={stats.down > 0 ? "down" : undefined} />
        <SummaryTile label="Avg response" value={stats.avg != null ? formatDuration(stats.avg) : "—"} />
      </dl>

      {/* ===== Monitors grid ===== */}
      {monitorsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" aria-label="Loading monitors" />
        </div>
      ) : monitorsQuery.error ? (
        <p role="alert" className="text-sm text-red-400 py-8 text-center">
          {(monitorsQuery.error as Error).message}
        </p>
      ) : monitors && monitors.length === 0 ? (
        <div className="glass-card text-center px-6 py-14 mb-6">
          <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" aria-hidden />
          <h2 className="text-base font-semibold text-gray-200 mb-1">No endpoints yet</h2>
          <p className="text-sm text-gray-500 mb-5">
            Add one endpoint or paste a list of URLs to check them all from this screen.
          </p>
          <button type="button" onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-2">
            <Plus className="w-4 h-4" aria-hidden />
            Add endpoints
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-4 mb-8">
          {monitors?.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              history={historyByMonitor.get(monitor.id) ?? []}
              isChecking={runner.inFlight.has(monitor.id)}
              now={now}
              onRun={() => runner.runChecks([monitor.id])}
              onEdit={() => {
                setEditing(monitor);
                updateMonitor.reset();
                setFormOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Delete monitor "${monitor.name}" and its logs?`)) {
                  deleteMonitor.mutate(monitor.id);
                  if (logFilter === monitor.id) setLogFilter(null);
                }
              }}
              onToggle={(enabled) => updateMonitor.mutate({ id: monitor.id, input: { isEnabled: enabled } })}
              onToggleBackground={(runInBackground) =>
                updateMonitor.mutate({ id: monitor.id, input: { runInBackground } })
              }
              onViewLogs={() => {
                setLogFilter(monitor.id);
                document.getElementById("monitor-logs")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          ))}
        </div>
      )}

      {/* ===== Logs ===== */}
      {monitors && monitors.length > 0 && (
        <MonitorLogsPanel
          monitors={monitors}
          logs={logs}
          isLoading={logsQuery.isLoading}
          monitorFilter={logFilter}
          onMonitorFilterChange={setLogFilter}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: MONITOR_LOGS_KEY })}
          isRefreshing={logsQuery.isFetching}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          onClear={handleClear}
          isClearing={clearLogs.isPending}
        />
      )}

      <MonitorFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        monitor={editing}
        onSubmit={handleSubmit}
        isSubmitting={createMonitors.isPending || updateMonitor.isPending}
        error={formError}
      />
    </>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="glass-card px-4 py-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={cn(
          "text-xl sm:text-2xl font-bold font-mono mt-0.5",
          tone === "up" ? "text-emerald-300" : tone === "down" ? "text-red-300" : "text-gray-100"
        )}
      >
        {value}
      </dd>
      {sub && <p className="text-2xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
