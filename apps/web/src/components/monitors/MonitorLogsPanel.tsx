"use client";

import React, { useMemo, useState } from "react";
import { Download, Eraser, Loader2, RefreshCw, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Monitor, MonitorLog } from "@api-flow/shared";

type ResultFilter = "all" | "up" | "down";

const PAGE_SIZE = 50;

export function MonitorLogsPanel({
  monitors,
  logs,
  isLoading,
  monitorFilter,
  onMonitorFilterChange,
  onRefresh,
  isRefreshing,
  onDownload,
  isDownloading,
  onClear,
  isClearing,
}: {
  monitors: Monitor[];
  logs: MonitorLog[];
  isLoading: boolean;
  monitorFilter: string | null;
  onMonitorFilterChange: (id: string | null) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDownload: (format: "csv" | "json") => void;
  isDownloading: boolean;
  onClear: () => void;
  isClearing: boolean;
}) {
  const [result, setResult] = useState<ResultFilter>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const nameById = useMemo(() => new Map(monitors.map((m) => [m.id, m.name])), [monitors]);

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (!monitorFilter || l.monitorId === monitorFilter) &&
          (result === "all" || (result === "up" ? l.isSuccess : !l.isSuccess))
      ),
    [logs, monitorFilter, result]
  );

  const shown = filtered.slice(0, visible);
  const selectedName = monitorFilter ? nameById.get(monitorFilter) : null;

  return (
    <section id="monitor-logs" aria-labelledby="logs-heading" className="glass-card scroll-mt-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 border-b border-line/5">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText className="w-4 h-4 text-brand-400 shrink-0" aria-hidden />
          <h2 id="logs-heading" className="text-sm font-semibold text-gray-100 truncate">
            Check logs{selectedName ? ` — ${selectedName}` : ""}
          </h2>
          <span className="text-2xs text-gray-500 shrink-0">({filtered.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <label className="sr-only" htmlFor="logs-monitor">
            Filter by monitor
          </label>
          <select
            id="logs-monitor"
            value={monitorFilter ?? ""}
            onChange={(e) => {
              onMonitorFilterChange(e.target.value || null);
              setVisible(PAGE_SIZE);
            }}
            className="input-field text-xs py-1.5 max-w-[180px]"
          >
            <option value="">All monitors</option>
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <div className="inline-flex p-0.5 rounded-lg bg-surface-2 border border-line/5" role="group" aria-label="Filter by result">
            {(["all", "up", "down"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={result === r}
                onClick={() => setResult(r)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md capitalize transition-colors",
                  result === r ? "bg-surface-4 text-gray-100" : "text-gray-400 hover:text-gray-200"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-ghost text-xs flex items-center gap-1.5 py-1.5"
            aria-label="Refresh logs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="inline-flex rounded-lg border border-line/10 overflow-hidden">
            <button
              type="button"
              onClick={() => onDownload("csv")}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-300 bg-surface-3 hover:bg-surface-4 disabled:opacity-50"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Download className="w-3.5 h-3.5" aria-hidden />}
              CSV
            </button>
            <button
              type="button"
              onClick={() => onDownload("json")}
              disabled={isDownloading}
              className="px-2.5 py-1.5 text-xs text-gray-300 bg-surface-3 hover:bg-surface-4 border-l border-line/10 disabled:opacity-50"
            >
              JSON
            </button>
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={isClearing || logs.length === 0}
            className="btn-danger text-xs flex items-center gap-1.5 py-1.5 px-2.5 disabled:opacity-40"
          >
            <Eraser className="w-3.5 h-3.5" aria-hidden />
            Clear{monitorFilter ? "" : " all"}
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-label="Loading logs" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12 px-4">
          No checks logged yet. Start monitoring or press ▶ on a monitor to run a check.
        </p>
      ) : (
        <>
          {/* Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-2xs uppercase tracking-wider text-gray-500 border-b border-line/5">
                  <th scope="col" className="font-medium px-4 py-2">Time</th>
                  <th scope="col" className="font-medium px-4 py-2">Monitor</th>
                  <th scope="col" className="font-medium px-4 py-2">Result</th>
                  <th scope="col" className="font-medium px-4 py-2">Status</th>
                  <th scope="col" className="font-medium px-4 py-2 text-right">Response</th>
                  <th scope="col" className="font-medium px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {shown.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-2 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-200 max-w-[220px] truncate">
                      {log.monitorName ?? nameById.get(log.monitorId) ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <ResultPill ok={log.isSuccess} />
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-300">{log.statusCode ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-gray-300 text-right whitespace-nowrap">
                      {log.responseTimeMs != null ? `${log.responseTimeMs} ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-[320px] truncate" title={log.errorMessage ?? ""}>
                      {log.errorMessage ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* List (phones) */}
          <ul className="md:hidden divide-y divide-line/5">
            {shown.map((log) => (
              <li key={log.id} className="px-4 py-3 flex items-start gap-3">
                <ResultPill ok={log.isSuccess} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate">
                    {log.monitorName ?? nameById.get(log.monitorId) ?? "—"}
                  </p>
                  <p className="text-2xs text-gray-500 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                  {log.errorMessage && (
                    <p className="text-xs text-red-300/80 mt-1 break-words">{log.errorMessage}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono text-gray-300">{log.statusCode ?? "ERR"}</p>
                  <p className="text-2xs font-mono text-gray-500">
                    {log.responseTimeMs != null ? `${log.responseTimeMs} ms` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {filtered.length > visible && (
            <div className="p-3 text-center border-t border-line/5">
              <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="btn-ghost text-xs">
                Show more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
          <p className="px-4 py-2 text-2xs text-gray-600 border-t border-line/5">
            Showing the latest checks in this session. Downloads include the full stored history.
          </p>
        </>
      )}
    </section>
  );
}

function ResultPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold shrink-0",
        ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-red-400")} aria-hidden />
      {ok ? "UP" : "DOWN"}
    </span>
  );
}
