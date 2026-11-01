"use client";

import React from "react";
import { Cloud, CloudOff, Loader2, Pencil, Play, ScrollText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@api-flow/shared";
import type { Monitor, MonitorLog } from "@api-flow/shared";
import type { HttpMethod } from "@api-flow/shared/constants";
import { MethodBadge } from "@/components/ui/MethodBadge";
import { formatInterval } from "./MonitorFormDialog";

export type MonitorState = "up" | "down" | "pending" | "paused";

export function monitorState(monitor: Monitor): MonitorState {
  if (!monitor.isEnabled) return "paused";
  if (!monitor.lastCheck) return "pending";
  return monitor.lastCheck.isSuccess ? "up" : "down";
}

const STATE_STYLES: Record<MonitorState, { label: string; dot: string; text: string; ring: string }> = {
  up: { label: "Up", dot: "bg-emerald-500", text: "text-emerald-300", ring: "border-emerald-500/20" },
  down: { label: "Down", dot: "bg-red-500", text: "text-red-300", ring: "border-red-500/30" },
  pending: { label: "Waiting", dot: "bg-gray-500", text: "text-gray-400", ring: "border-line/5" },
  paused: { label: "Paused", dot: "bg-gray-600", text: "text-gray-500", ring: "border-line/5" },
};

export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function MonitorCard({
  monitor,
  history,
  isChecking,
  now,
  onRun,
  onEdit,
  onDelete,
  onToggle,
  onToggleBackground,
  onViewLogs,
}: {
  monitor: Monitor;
  /** Recent checks, newest first */
  history: MonitorLog[];
  isChecking: boolean;
  now: number;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onToggleBackground: (runInBackground: boolean) => void;
  onViewLogs: () => void;
}) {
  const state = monitorState(monitor);
  const style = STATE_STYLES[state];
  const last = monitor.lastCheck;

  const recent = history.slice(0, 30).reverse();
  const uptime =
    history.length > 0
      ? Math.round((history.filter((l) => l.isSuccess).length / history.length) * 1000) / 10
      : null;
  const maxTime = Math.max(1, ...recent.map((l) => l.responseTimeMs ?? 0));

  return (
    <article
      aria-label={`${monitor.name} — ${style.label}`}
      className={cn("glass-card p-4 flex flex-col gap-3 border", style.ring, !monitor.isEnabled && "opacity-70")}
    >
      {/* Title row */}
      <div className="flex items-start gap-3">
        <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
          {state === "up" && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          )}
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", style.dot)} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-100 truncate" title={monitor.name}>
            {monitor.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            <MethodBadge method={monitor.method as HttpMethod} size="sm" className="shrink-0" />
            <span className="text-xs text-gray-500 font-mono truncate" title={monitor.url}>
              {monitor.url}
            </span>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0" title={monitor.isEnabled ? "Pause" : "Resume"}>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={monitor.isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={`${monitor.isEnabled ? "Pause" : "Resume"} ${monitor.name}`}
          />
          <span className="w-9 h-5 rounded-full bg-surface-4 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Status">
          <span className={cn("font-mono", style.text)}>
            {last?.statusCode ?? (last ? "ERR" : "—")}
          </span>
        </Stat>
        <Stat label="Response">
          <span className="font-mono text-gray-200">
            {last?.responseTimeMs != null ? formatDuration(last.responseTimeMs) : "—"}
          </span>
        </Stat>
        <Stat label="Uptime">
          <span className="font-mono text-gray-200">{uptime != null ? `${uptime}%` : "—"}</span>
        </Stat>
      </dl>

      {/* Sparkline: last 30 checks */}
      <div className="flex items-end gap-0.5 h-8" aria-hidden>
        {recent.length === 0 ? (
          <div className="flex-1 h-px bg-line/10 self-center" />
        ) : (
          recent.map((log) => (
            <div
              key={log.id}
              title={`${log.statusCode ?? "ERR"} · ${log.responseTimeMs ?? 0} ms · ${new Date(log.createdAt).toLocaleTimeString()}`}
              className={cn("flex-1 min-w-[3px] max-w-[10px] rounded-sm", log.isSuccess ? "bg-emerald-500/70" : "bg-red-500/80")}
              style={{ height: `${Math.max(15, ((log.responseTimeMs ?? 0) / maxTime) * 100)}%` }}
            />
          ))
        )}
      </div>

      {last && !last.isSuccess && last.errorMessage && (
        <p className="text-xs text-red-300/90 bg-red-500/5 border border-red-500/10 rounded-md px-2 py-1.5 break-words line-clamp-2">
          {last.errorMessage}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/5">
        <p className="text-2xs text-gray-500">
          Every {formatInterval(monitor.intervalSeconds)}
          {monitor.runInBackground && <> · in background</>}
          {last && <> · {timeAgo(last.createdAt, now)}</>}
        </p>
        <div className="flex items-center -mr-1.5">
          <IconButton
            label={monitor.runInBackground ? "Run only while this page is open" : "Run in background"}
            onClick={() => onToggleBackground(!monitor.runInBackground)}
            pressed={monitor.runInBackground}
          >
            {monitor.runInBackground ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
          </IconButton>
          <IconButton label="Run check now" onClick={onRun} disabled={isChecking}>
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </IconButton>
          <IconButton label="View logs" onClick={onViewLogs}>
            <ScrollText className="w-4 h-4" />
          </IconButton>
          <IconButton label="Edit" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </IconButton>
          <IconButton label="Delete" onClick={onDelete} danger>
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-2 py-1.5">
      <dt className="text-2xs text-gray-500">{label}</dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Renders as a toggle button (aria-pressed, highlighted when on) */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "p-2 rounded-lg text-gray-500 transition-colors disabled:opacity-50",
        pressed && "text-brand-300",
        danger ? "hover:text-red-400 hover:bg-red-500/10" : "hover:text-gray-200 hover:bg-surface-3"
      )}
    >
      {children}
    </button>
  );
}
