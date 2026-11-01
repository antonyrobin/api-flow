"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileJson, Loader2, Trash2, Upload } from "lucide-react";
import type { ImportSummary } from "@api-flow/shared/validators";
import { nanoid } from "@api-flow/shared";
import { Dialog } from "@/components/ui/Dialog";
import { useSession } from "@/lib/auth-client";
import { apiDownload, apiFetch } from "@/lib/api";
import { emptyBackup, ImportError, mergeBackups, parseImportText, type ParsedImport } from "@/lib/importers";
import { COLLECTIONS_KEY, SAVED_REQUESTS_KEY } from "@/hooks/use-saved-requests";
import { MAX_TABS, snapshotTabs, useRequestStore } from "@/stores/request-store";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Backup & import:
 * - Import Postman collections / environments / data dumps and API Flow backups
 *   (signed in: into the account · guests: opened as tabs)
 * - Download a full account backup (signed in)
 * - Export open tabs as a backup file (everyone)
 */
export function BackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const isSignedIn = !!session;
  const queryClient = useQueryClient();
  const newTab = useRequestStore((s) => s.newTab);
  const fileInput = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedImport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"import" | "export" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setParsed([]);
    setErrors([]);
    setPasted("");
    setPasteMode(false);
    setResult(null);
  }, [open]);

  const addTexts = (items: { text: string; name: string }[]) => {
    const ok: ParsedImport[] = [];
    const bad: string[] = [];
    for (const { text, name } of items) {
      try {
        ok.push(parseImportText(text, name));
      } catch (err) {
        bad.push(err instanceof ImportError ? err.message : `${name}: could not be read`);
      }
    }
    setParsed((prev) => [...prev, ...ok]);
    setErrors(bad);
    setResult(null);
  };

  const readFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
    const texts = await Promise.all(
      list.filter((f) => f.size <= MAX_FILE_BYTES).map(async (f) => ({ text: await f.text(), name: f.name }))
    );
    addTexts(texts);
    if (tooBig.length) setErrors((e) => [...e, ...tooBig.map((f) => `${f.name}: larger than 8 MB`)]);
  };

  const combined = mergeBackups(parsed.map((p) => p.backup));
  const totals = {
    collections: combined.collections.length,
    requests: combined.requests.length,
    environments: combined.environments.length,
    monitors: combined.monitors.length,
  };
  const warnings = parsed.flatMap((p) => p.warnings);

  const importIntoAccount = async () => {
    setBusy("import");
    setErrors([]);
    try {
      const res = await apiFetch<{ data: ImportSummary }>("/backup/import", {
        method: "POST",
        body: JSON.stringify(combined),
      });
      const s = res.data;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SAVED_REQUESTS_KEY }),
        queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["monitors"] }),
      ]);
      setParsed([]);
      setResult(
        `Imported ${s.collections} collection(s), ${s.requests} request(s), ${s.environments} environment(s)` +
          (s.monitors ? `, ${s.monitors} monitor(s)` : "") +
          (s.skippedMonitors ? ` — ${s.skippedMonitors} monitor(s) skipped (limit or invalid URL)` : "") +
          "."
      );
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(null);
    }
  };

  const openAsTabs = () => {
    const room = MAX_TABS - snapshotTabs(useRequestStore.getState()).length;
    const toOpen = combined.requests.slice(0, Math.max(0, room));
    for (const r of toOpen) {
      newTab({
        id: nanoid(),
        name: r.name,
        method: r.method,
        url: r.url,
        headers: r.headers,
        queryParams: r.queryParams,
        body: r.body,
        bodyType: r.bodyType,
        authType: r.authType,
        authConfig: r.authConfig,
      });
    }
    setParsed([]);
    setResult(
      `Opened ${toOpen.length} request(s) in tabs` +
        (toOpen.length < combined.requests.length ? ` (tab limit is ${MAX_TABS})` : "") +
        "."
    );
  };

  const downloadAccountBackup = async () => {
    setBusy("export");
    setErrors([]);
    try {
      await apiDownload("/backup/export", `api-flow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(null);
    }
  };

  const exportTabs = () => {
    const backup = emptyBackup();
    backup.requests = snapshotTabs(useRequestStore.getState())
      .filter((t) => t.request.url.trim())
      .map(({ request: r }) => ({
        name: r.name,
        method: r.method,
        url: r.url,
        headers: r.headers,
        queryParams: r.queryParams,
        body: r.body,
        bodyType: r.bodyType,
        authType: r.authType,
        authConfig: r.authConfig,
      }));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `api-flow-tabs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Backup & import"
      description="Import Postman collections, environments or an API Flow backup — or download a backup of your workspace."
    >
      <div className="space-y-6">
        {/* ===== Import ===== */}
        <section aria-labelledby="import-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="import-heading" className="text-sm font-semibold text-gray-200">
              Import
            </h3>
            <button
              type="button"
              onClick={() => setPasteMode(!pasteMode)}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              {pasteMode ? "Choose files instead" : "Paste JSON instead"}
            </button>
          </div>

          {pasteMode ? (
            <div className="space-y-2">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                spellCheck={false}
                aria-label="Collection or backup JSON"
                placeholder='{ "info": { "name": "My API", "schema": "…/collection/v2.1.0/collection.json" }, "item": [ … ] }'
                className="w-full input-field font-mono text-xs"
              />
              <button
                type="button"
                disabled={!pasted.trim()}
                onClick={() => {
                  addTexts([{ text: pasted, name: "pasted JSON" }]);
                  setPasted("");
                }}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Read JSON
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void readFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 px-4 py-7 rounded-xl border-2 border-dashed text-center transition-colors",
                dragOver ? "border-brand-500 bg-brand-500/5" : "border-line/10"
              )}
            >
              <Upload className="w-6 h-6 text-gray-500" aria-hidden />
              <p className="text-sm text-gray-300">
                Drop files here or{" "}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-brand-400 hover:text-brand-300 font-medium"
                >
                  browse
                </button>
              </p>
              <p className="text-2xs text-gray-500">
                Postman Collection v2.0/v2.1 · Postman environment · Postman data export · API Flow backup (.json)
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) void readFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {parsed.length > 0 && (
            <div className="rounded-xl border border-line/10 bg-surface-2/50 divide-y divide-line/5">
              {parsed.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <FileJson className="w-4 h-4 text-brand-400 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">{p.label}</p>
                    <p className="text-2xs text-gray-500">
                      {p.backup.collections.length} collection(s) · {p.backup.requests.length} request(s) ·{" "}
                      {p.backup.environments.length} environment(s)
                      {p.backup.monitors.length ? ` · ${p.backup.monitors.length} monitor(s)` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${p.label}`}
                    onClick={() => setParsed(parsed.filter((_, j) => j !== i))}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-surface-4"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="text-xs text-amber-300 space-y-1">
              {[...new Set(warnings)].slice(0, 8).map((w) => (
                <li key={w} className="flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}

          {parsed.length > 0 &&
            (isSignedIn ? (
              <button
                type="button"
                onClick={importIntoAccount}
                disabled={busy !== null}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
              >
                {busy === "import" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                Import {totals.requests} request(s)
                {totals.collections ? ` in ${totals.collections} collection(s)` : ""} into my account
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={openAsTabs}
                  disabled={!totals.requests}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  Open {totals.requests} request(s) in tabs
                </button>
                <Link href="/login" className="btn-secondary text-sm text-center">
                  Sign in to save them to an account
                </Link>
              </div>
            ))}
        </section>

        {/* ===== Backup ===== */}
        <section aria-labelledby="backup-heading" className="space-y-3 pt-5 border-t border-line/5">
          <h3 id="backup-heading" className="text-sm font-semibold text-gray-200">
            Backup
          </h3>
          {isSignedIn ? (
            <p className="text-xs text-gray-500">
              Downloads every collection, folder, saved request, environment and monitor as one JSON file. Restore it
              any time with Import above — restoring adds copies and never overwrites existing data.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              <Link href="/login" className="text-brand-400 hover:text-brand-300">
                Sign in
              </Link>{" "}
              to back up your saved collections. You can still export the tabs open in this browser.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            {isSignedIn && (
              <button
                type="button"
                onClick={downloadAccountBackup}
                disabled={busy !== null}
                className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy === "export" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
                Download full backup
              </button>
            )}
            <button type="button" onClick={exportTabs} className="btn-secondary text-sm flex items-center justify-center gap-2">
              <Download className="w-4 h-4" aria-hidden />
              Export open tabs
            </button>
          </div>
        </section>

        {errors.length > 0 && (
          <div role="alert" className="text-sm text-red-400 space-y-1">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        {result && (
          <p role="status" className="flex items-start gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            {result}
          </p>
        )}
      </div>
    </Dialog>
  );
}
