"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRequestStore } from "@/stores/request-store";
import { useApiRequest } from "@/hooks/use-api-request";
import { MethodBadge } from "@/components/ui/MethodBadge";
import { SaveRequestDialog } from "@/components/workspace/SaveRequestDialog";
import { HeaderEditor } from "./HeaderEditor";
import { BodyEditor } from "./BodyEditor";
import { QueryParams } from "./QueryParams";
import { AuthConfig } from "./AuthConfig";
import { cn } from "@/lib/utils";
import { HTTP_METHODS } from "@api-flow/shared/constants";
import type { HttpMethod } from "@api-flow/shared/constants";
import { Send, ChevronDown, Save, Settings2, FileCode2, Lock, Link2, Loader2 } from "lucide-react";

type TabId = "params" | "headers" | "body" | "auth";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "params", label: "Params", icon: <Link2 className="w-3.5 h-3.5" aria-hidden /> },
  { id: "headers", label: "Headers", icon: <Settings2 className="w-3.5 h-3.5" aria-hidden /> },
  { id: "body", label: "Body", icon: <FileCode2 className="w-3.5 h-3.5" aria-hidden /> },
  { id: "auth", label: "Auth", icon: <Lock className="w-3.5 h-3.5" aria-hidden /> },
];

export function RequestBuilder() {
  const { activeRequest, savedRequestId, isExecuting, setMethod, setUrl } = useRequestStore(
    useShallow((s) => ({ activeRequest: s.activeRequest, savedRequestId: s.savedRequestId, isExecuting: s.isExecuting, setMethod: s.setMethod, setUrl: s.setUrl }))
  );

  const { execute } = useApiRequest();
  const [activeTab, setActiveTab] = useState<TabId>("params");
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const handleSend = useCallback(() => {
    if (!activeRequest.url.trim() || isExecuting) return;
    execute();
  }, [activeRequest.url, execute, isExecuting]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Global shortcuts: Ctrl/Cmd+Enter to send, Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSaveOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full">
      {/* ===== Request name ===== */}
      <div className="flex items-center gap-2 px-3 sm:px-4 pt-3 text-xs text-gray-500 min-w-0">
        <span className="truncate text-gray-300 font-medium">{activeRequest.name}</span>
        {savedRequestId ? (
          <span className="shrink-0 px-1.5 py-0.5 rounded bg-brand-600/15 text-brand-300 text-2xs">Saved</span>
        ) : (
          <span className="shrink-0 px-1.5 py-0.5 rounded bg-surface-3 text-gray-500 text-2xs">Unsaved</span>
        )}
      </div>

      {/* ===== URL Bar ===== */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:flex sm:items-center gap-2 p-3 sm:p-4 border-b border-line/5">
        {/* Method Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMethodDropdown(!showMethodDropdown)}
            aria-haspopup="listbox"
            aria-expanded={showMethodDropdown}
            aria-label={`HTTP method: ${activeRequest.method}`}
            className={cn(
              "h-full flex items-center gap-1.5 px-3 py-2.5 rounded-lg",
              "bg-surface-2 border border-line/10",
              "hover:bg-surface-3 transition-all duration-200",
              "font-mono font-bold text-sm min-w-[96px] justify-between"
            )}
          >
            <MethodBadge method={activeRequest.method} size="sm" />
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" aria-hidden />
          </button>

          {showMethodDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMethodDropdown(false)} />
              <ul
                role="listbox"
                aria-label="HTTP method"
                className="absolute top-full left-0 mt-1 z-20 w-36 bg-surface-2 border border-line/10 rounded-lg shadow-xl overflow-hidden animate-scale-in"
              >
                {HTTP_METHODS.map((m) => (
                  <li key={m} role="option" aria-selected={activeRequest.method === m}>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod(m as HttpMethod);
                        setShowMethodDropdown(false);
                      }}
                      className={cn(
                        "flex items-center w-full px-3 py-2.5 text-left",
                        "hover:bg-surface-3 transition-colors duration-100",
                        activeRequest.method === m && "bg-surface-3"
                      )}
                    >
                      <MethodBadge method={m as HttpMethod} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* URL Input */}
        <div className="sm:flex-1 min-w-0">
          <label htmlFor="request-url" className="sr-only">
            Request URL
          </label>
          <input
            id="request-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={activeRequest.url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://api.example.com/users"
            className={cn(
              "w-full px-3 sm:px-4 py-2.5 rounded-lg font-mono text-sm",
              "bg-surface-2 border border-line/10",
              "text-gray-200 placeholder-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40",
              "transition-all duration-200"
            )}
          />
        </div>

        <div className="col-span-2 flex gap-2">
          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isExecuting || !activeRequest.url.trim()}
            className={cn(
              "btn-primary flex-1 sm:flex-none flex items-center gap-2 sm:min-w-[110px] justify-center",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Send className="w-4 h-4" aria-hidden />
            )}
            {isExecuting ? "Sending..." : "Send"}
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="btn-secondary flex items-center gap-2"
            title="Save request (Ctrl+S)"
            aria-label="Save request"
          >
            <Save className="w-4 h-4" aria-hidden />
            <span className="sm:hidden">Save</span>
          </button>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div
        role="tablist"
        aria-label="Request options"
        className="flex items-center border-b border-line/5 px-2 sm:px-4 overflow-x-auto no-scrollbar"
      >
        {TABS.map((tab) => (
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
            {tab.icon}
            {tab.label}
            {tab.id === "headers" && activeRequest.headers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-2xs bg-surface-4 rounded-full text-gray-400">
                {activeRequest.headers.filter((h) => h.enabled).length}
              </span>
            )}
            {tab.id === "params" && activeRequest.queryParams.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-2xs bg-surface-4 rounded-full text-gray-400">
                {activeRequest.queryParams.filter((p) => p.enabled).length}
              </span>
            )}
            {tab.id === "auth" && activeRequest.authType !== "none" && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-brand-400" aria-label="configured" />
            )}
          </button>
        ))}
      </div>

      {/* ===== Tab Content ===== */}
      <div role="tabpanel" className="flex-1 overflow-auto p-3 sm:p-4">
        {activeTab === "params" && <QueryParams />}
        {activeTab === "headers" && <HeaderEditor />}
        {activeTab === "body" && <BodyEditor />}
        {activeTab === "auth" && <AuthConfig />}
      </div>

      <SaveRequestDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
