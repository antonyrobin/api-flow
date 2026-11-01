"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRequestStore } from "@/stores/request-store";
import { ResponseMeta } from "@/components/ui/StatusBadge";
import { TimingWaterfall } from "./TimingWaterfall";
import { CodeBlock, JsonTree, XmlTree } from "./Highlight";
import {
  BODY_FORMAT_LABELS,
  detectFormat,
  fileExtension,
  getContentType,
  prettyBody,
  type BodyFormat,
} from "./body-format";
import { cn } from "@/lib/utils";
import { FileJson, ListTree, Clock, AlertCircle, Copy, Check, Download, WrapText } from "lucide-react";
import type { ApiResponse } from "@api-flow/shared";

type ResponseTab = "body" | "headers" | "timing";
type ViewMode = "pretty" | "raw" | "preview";

export function ResponseViewer() {
  const { activeResponse, isExecuting, error } = useRequestStore();
  const [activeTab, setActiveTab] = useState<ResponseTab>("body");

  // Loading state
  if (isExecuting) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-4" aria-live="polite">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-surface-4 border-t-brand-500 rounded-full animate-spin" />
        </div>
        <p className="text-gray-400 text-sm animate-pulse">Sending request...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3 px-6 sm:px-8">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-red-400 font-medium">Request Failed</p>
        <p className="text-gray-500 text-sm text-center max-w-md break-words">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!activeResponse) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3 px-6 text-center text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-line/5 flex items-center justify-center">
          <FileJson className="w-7 h-7 text-gray-600" />
        </div>
        <p className="text-sm font-medium">No Response Yet</p>
        <p className="text-xs text-gray-600">
          Enter a URL and press{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-gray-400 text-2xs">Enter</kbd> or tap Send
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Response Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-line/5">
        <ResponseMeta
          statusCode={activeResponse.statusCode}
          timeMs={activeResponse.timing.totalMs}
          sizeBytes={activeResponse.bodySize}
        />
        {activeResponse.truncated && (
          <span className="text-2xs px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Body truncated to 5 MB
          </span>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Response details"
        className="flex items-center border-b border-line/5 px-2 sm:px-4 overflow-x-auto no-scrollbar"
      >
        {(
          [
            { id: "body" as const, label: "Body", icon: FileJson },
            { id: "headers" as const, label: "Headers", icon: ListTree },
            { id: "timing" as const, label: "Timing", icon: Clock },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "tab-button flex items-center gap-1.5 shrink-0 py-2.5",
                activeTab === tab.id && "tab-button-active"
              )}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {tab.label}
              {tab.id === "headers" && (
                <span className="ml-1 px-1.5 py-0.5 text-2xs bg-surface-4 rounded-full text-gray-400">
                  {Object.keys(activeResponse.headers).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "body" && <ResponseBody response={activeResponse} />}

        {activeTab === "headers" && (
          <dl className="p-3 sm:p-4 space-y-1">
            {Object.entries(activeResponse.headers).map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-1.5 px-2 rounded hover:bg-surface-2/50 transition-colors"
              >
                <dt className="text-brand-400 font-mono text-xs sm:text-sm font-medium sm:w-56 shrink-0 break-all">
                  {key}
                </dt>
                <dd className="text-gray-300 font-mono text-xs sm:text-sm break-all">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {activeTab === "timing" && (
          <div className="p-3 sm:p-4">
            <TimingWaterfall timing={activeResponse.timing} />
          </div>
        )}
      </div>
    </div>
  );
}

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "pretty", label: "Pretty" },
  { id: "raw", label: "Raw" },
  { id: "preview", label: "Preview" },
];

/** Formats a viewer can be switched to ("auto" = from Content-Type / content) */
const FORMAT_OPTIONS: BodyFormat[] = ["json", "xml", "html", "javascript", "css", "text"];

function ResponseBody({ response }: { response: ApiResponse }) {
  const contentType = getContentType(response.headers);
  const detected = useMemo(() => detectFormat(response.body, contentType), [response.body, contentType]);
  const [override, setOverride] = useState<BodyFormat | null>(null);
  const [mode, setMode] = useState<ViewMode>("pretty");
  const [wrap, setWrap] = useState(true);
  const [copied, setCopied] = useState(false);

  // New response → back to the detected format
  useEffect(() => setOverride(null), [response]);

  const format = override ?? detected;
  const pretty = useMemo(() => prettyBody(response.body, format), [response.body, format]);
  const parsedJson = useMemo(() => {
    if (mode !== "preview" || format !== "json") return undefined;
    try {
      return { value: JSON.parse(response.body) as unknown };
    } catch {
      return null;
    }
  }, [mode, format, response.body]);

  const shown = mode === "raw" ? response.body : pretty;

  const copy = async () => {
    await navigator.clipboard.writeText(shown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([response.body], { type: contentType || "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `response.${fileExtension(format)}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const iconButton =
    "p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors";

  return (
    <div className="flex flex-col min-h-full">
      {/* Body toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 border-b border-line/5 bg-surface-0/95 backdrop-blur">
        <div role="radiogroup" aria-label="Body view" className="flex p-0.5 rounded-lg bg-surface-2 border border-line/5">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                mode === m.id ? "bg-surface-4 text-gray-100 shadow-sm" : "text-gray-400 hover:text-gray-200"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="response-format">
          Response format
        </label>
        <select
          id="response-format"
          value={override ?? "auto"}
          onChange={(e) => setOverride(e.target.value === "auto" ? null : (e.target.value as BodyFormat))}
          className="input-field py-1 pl-2 pr-7 text-xs w-auto"
        >
          <option value="auto">Auto ({BODY_FORMAT_LABELS[detected]})</option>
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {BODY_FORMAT_LABELS[f]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-0.5">
          {mode !== "preview" && (
            <button
              type="button"
              onClick={() => setWrap(!wrap)}
              aria-pressed={wrap}
              className={cn(iconButton, wrap && "text-brand-400")}
              title={wrap ? "Disable line wrap" : "Wrap lines"}
              aria-label="Toggle line wrap"
            >
              <WrapText className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={download} className={iconButton} title="Download body" aria-label="Download response body">
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={copy}
            className={iconButton}
            title="Copy"
            aria-label={copied ? "Copied" : "Copy response body"}
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body content */}
      <div className="flex-1 min-h-0">
        {!response.body ? (
          <p className="p-4 text-sm text-gray-500">Empty response body.</p>
        ) : mode !== "preview" ? (
          <CodeBlock text={shown} format={mode === "raw" ? "text" : format} wrap={wrap} />
        ) : format === "html" ? (
          <iframe
            title="HTML preview"
            // No scripts, forms, popups or same-origin access — static render only
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={response.body}
            className="w-full h-full min-h-[400px] bg-white border-0"
          />
        ) : format === "json" ? (
          parsedJson ? (
            <JsonTree value={parsedJson.value} />
          ) : (
            <p className="p-4 text-sm text-amber-300">This body isn&apos;t valid JSON. Try Raw or another format.</p>
          )
        ) : format === "xml" ? (
          <XmlTree source={response.body} />
        ) : (
          <CodeBlock text={response.body} format="text" wrap />
        )}
      </div>
    </div>
  );
}
