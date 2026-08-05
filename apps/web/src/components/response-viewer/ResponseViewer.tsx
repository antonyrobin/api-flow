"use client";

import React, { useState } from "react";
import { useRequestStore } from "@/stores/request-store";
import { StatusBadge, ResponseMeta } from "@/components/ui/StatusBadge";
import { TimingWaterfall } from "./TimingWaterfall";
import { cn } from "@/lib/utils";
import { FileJson, ListTree, Clock, AlertCircle, Copy, Check } from "lucide-react";

type ResponseTab = "body" | "headers" | "timing";

export function ResponseViewer() {
  const { activeResponse, isExecuting, error } = useRequestStore();
  const [activeTab, setActiveTab] = useState<ResponseTab>("body");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (isExecuting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
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
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-red-400 font-medium">Request Failed</p>
        <p className="text-gray-500 text-sm text-center max-w-md">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!activeResponse) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center">
          <FileJson className="w-7 h-7 text-gray-600" />
        </div>
        <p className="text-sm font-medium">No Response Yet</p>
        <p className="text-xs text-gray-600">
          Enter a URL and hit <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-gray-400 text-2xs">Ctrl+Enter</kbd> to send a request
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Response Meta Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <ResponseMeta
          statusCode={activeResponse.statusCode}
          timeMs={activeResponse.timing.totalMs}
          sizeBytes={activeResponse.bodySize}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-white/5 px-4">
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
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "tab-button flex items-center gap-1.5",
                activeTab === tab.id && "tab-button-active"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
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
        {activeTab === "body" && (
          <div className="relative">
            {/* Copy button */}
            <button
              onClick={() => copyToClipboard(activeResponse.body)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-surface-3/80 hover:bg-surface-4 text-gray-400 hover:text-gray-200 transition-all"
              title="Copy response"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
              {formatBody(activeResponse.body)}
            </pre>
          </div>
        )}

        {activeTab === "headers" && (
          <div className="p-4 space-y-1">
            {Object.entries(activeResponse.headers).map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-4 py-1.5 px-2 rounded hover:bg-surface-2/50 transition-colors"
              >
                <span className="text-brand-400 font-mono text-sm font-medium min-w-[180px] shrink-0">
                  {key}
                </span>
                <span className="text-gray-300 font-mono text-sm break-all">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "timing" && (
          <div className="p-4">
            <TimingWaterfall timing={activeResponse.timing} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Attempt to pretty-print JSON responses.
 */
function formatBody(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}
