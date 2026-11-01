"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { HTTP_METHODS, METHODS_WITH_BODY } from "@api-flow/shared/constants";
import type { HttpMethod } from "@api-flow/shared/constants";
import type { Monitor } from "@api-flow/shared";
import type { CreateMonitorInput } from "@api-flow/shared/validators";
import { MONITOR_LIMITS } from "@api-flow/shared/validators";

export const INTERVAL_PRESETS = [
  { label: "10 sec", value: 10 },
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
  { label: "1 hour", value: 3600 },
];

export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${+(seconds / 3600).toFixed(1)}h`;
}

function headersToText(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function textToHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  text.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim();
    if (key) headers[key] = line.slice(idx + 1).trim();
  });
  return headers;
}

function normaliseUrl(raw: string): string {
  const url = raw.trim();
  return url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 100);
  } catch {
    return url.slice(0, 100);
  }
}

type Mode = "single" | "bulk";

export function MonitorFormDialog({
  open,
  onClose,
  monitor,
  onSubmit,
  isSubmitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  /** When set the dialog edits this monitor */
  monitor: Monitor | null;
  onSubmit: (inputs: Partial<CreateMonitorInput>[]) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const isEdit = !!monitor;
  const [mode, setMode] = useState<Mode>("single");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [expectedStatus, setExpectedStatus] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [body, setBody] = useState("");
  const [runInBackground, setRunInBackground] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("single");
    setLocalError(null);
    setName(monitor?.name ?? "");
    setMethod((monitor?.method as HttpMethod) ?? "GET");
    setUrl(monitor?.url ?? "");
    setBulkUrls("");
    setIntervalSeconds(monitor?.intervalSeconds ?? 60);
    setTimeoutMs(monitor?.timeoutMs ?? 10000);
    setExpectedStatus(monitor?.expectedStatus ? String(monitor.expectedStatus) : "");
    setHeadersText(monitor ? headersToText(monitor.headers) : "");
    setBody(monitor?.body ?? "");
    setRunInBackground(monitor?.runInBackground ?? false);
  }, [open, monitor]);

  const isCustomInterval = !INTERVAL_PRESETS.some((p) => p.value === intervalSeconds);
  const supportsBody = (METHODS_WITH_BODY as string[]).includes(method);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (
      intervalSeconds < MONITOR_LIMITS.minIntervalSeconds ||
      intervalSeconds > MONITOR_LIMITS.maxIntervalSeconds
    ) {
      setLocalError("Interval must be between 10 seconds and 24 hours.");
      return;
    }

    const status = expectedStatus.trim() ? Number(expectedStatus) : null;
    if (status !== null && (!Number.isInteger(status) || status < 100 || status > 599)) {
      setLocalError("Expected status must be a number between 100 and 599.");
      return;
    }

    const shared = {
      method,
      intervalSeconds,
      timeoutMs,
      expectedStatus: status,
      headers: textToHeaders(headersText),
      body: supportsBody && body.trim() ? body : null,
      runInBackground,
    };

    if (mode === "bulk" && !isEdit) {
      const urls = [...new Set(bulkUrls.split(/\s+/).map(normaliseUrl).filter(Boolean))];
      if (urls.length === 0) {
        setLocalError("Add at least one URL (one per line).");
        return;
      }
      onSubmit(urls.map((u) => ({ ...shared, url: u, name: nameFromUrl(u) })));
      return;
    }

    const finalUrl = normaliseUrl(url);
    if (!finalUrl) {
      setLocalError("URL is required.");
      return;
    }
    onSubmit([{ ...shared, url: finalUrl, name: name.trim() || nameFromUrl(finalUrl) }]);
  };

  const shownError = localError || error;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Edit endpoint" : "Add endpoints to monitor"}
      description={
        isEdit ? undefined : "Each endpoint is checked on its interval while the Monitors page is open."
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="monitor-form"
            disabled={isSubmitting}
            className="btn-primary text-sm disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : isEdit ? "Save changes" : mode === "bulk" ? "Add all" : "Add endpoint"}
          </button>
        </>
      }
    >
      <form id="monitor-form" onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="inline-flex p-1 rounded-lg bg-surface-2 border border-line/5" role="tablist">
            {(["single", "bulk"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  mode === m ? "bg-surface-4 text-gray-100" : "text-gray-400 hover:text-gray-200"
                )}
              >
                {m === "single" ? "Single endpoint" : "Bulk add"}
              </button>
            ))}
          </div>
        )}

        {mode === "single" || isEdit ? (
          <>
            <Field label="Name" htmlFor="monitor-name" hint="Optional — defaults to the URL host and path">
              <input
                id="monitor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Payments API health"
                className="w-full input-field"
              />
            </Field>

            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <Field label="Method" htmlFor="monitor-method">
                <select
                  id="monitor-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className="w-full input-field font-mono"
                >
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="URL" htmlFor="monitor-url">
                <input
                  id="monitor-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/health"
                  required
                  className="w-full input-field font-mono"
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Method" htmlFor="monitor-method-bulk">
              <select
                id="monitor-method-bulk"
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full sm:w-40 input-field font-mono"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="URLs"
              htmlFor="monitor-bulk-urls"
              hint={`One URL per line (max ${MONITOR_LIMITS.maxMonitorsPerUser} monitors per account)`}
            >
              <textarea
                id="monitor-bulk-urls"
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={"https://api.example.com/health\nhttps://auth.example.com/status\nhttps://example.com"}
                className="w-full input-field font-mono text-xs"
              />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Check every" htmlFor="monitor-interval">
            <select
              id="monitor-interval"
              value={isCustomInterval ? "custom" : intervalSeconds}
              onChange={(e) =>
                setIntervalSeconds(e.target.value === "custom" ? 120 : Number(e.target.value))
              }
              className="w-full input-field"
            >
              {INTERVAL_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {isCustomInterval && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={MONITOR_LIMITS.minIntervalSeconds}
                  max={MONITOR_LIMITS.maxIntervalSeconds}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  aria-label="Custom interval in seconds"
                  className="w-full input-field"
                />
                <span className="text-xs text-gray-500">sec</span>
              </div>
            )}
          </Field>

          <Field label="Timeout" htmlFor="monitor-timeout">
            <select
              id="monitor-timeout"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-full input-field"
            >
              {[3000, 5000, 10000, 20000, 30000, 60000].map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000} seconds
                </option>
              ))}
            </select>
          </Field>

          <Field label="Expected status" htmlFor="monitor-status" hint="Blank = any 2xx/3xx">
            <input
              id="monitor-status"
              type="number"
              inputMode="numeric"
              min={100}
              max={599}
              value={expectedStatus}
              onChange={(e) => setExpectedStatus(e.target.value)}
              placeholder="200"
              className="w-full input-field"
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-line/5 bg-surface-2/40 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={runInBackground}
            onChange={(e) => setRunInBackground(e.target.checked)}
            className="mt-0.5 accent-brand-500"
          />
          <span className="text-sm text-gray-300">
            Run in background
            <span className="block text-xs text-gray-500">
              Checked by the server on its interval, even when this page is closed.
            </span>
          </span>
        </label>

        <details className="group rounded-lg border border-line/5 bg-surface-2/40" open={!!headersText || !!body}>
          <summary className="cursor-pointer select-none px-3 py-2.5 text-sm text-gray-300">
            Headers{supportsBody ? " & body" : ""} <span className="text-gray-500">(optional)</span>
          </summary>
          <div className="px-3 pb-3 space-y-3">
            <Field label="Headers" htmlFor="monitor-headers" hint="One per line, e.g. Authorization: Bearer …">
              <textarea
                id="monitor-headers"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="Accept: application/json"
                className="w-full input-field font-mono text-xs"
              />
            </Field>
            {supportsBody && (
              <Field label="Body" htmlFor="monitor-body">
                <textarea
                  id="monitor-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder='{"ping": true}'
                  className="w-full input-field font-mono text-xs"
                />
              </Field>
            )}
          </div>
        </details>

        {shownError && (
          <p role="alert" className="text-sm text-red-400 whitespace-pre-line">
            {shownError}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-2xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
