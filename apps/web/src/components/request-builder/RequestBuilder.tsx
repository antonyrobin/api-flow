"use client";

import React, { useState, useCallback } from "react";
import { useRequestStore } from "@/stores/request-store";
import { useApiRequest } from "@/hooks/use-api-request";
import { MethodBadge } from "@/components/ui/MethodBadge";
import { HeaderEditor } from "./HeaderEditor";
import { BodyEditor } from "./BodyEditor";
import { QueryParams } from "./QueryParams";
import { AuthConfig } from "./AuthConfig";
import { cn } from "@/lib/utils";
import { HTTP_METHODS } from "@api-flow/shared/constants";
import type { HttpMethod } from "@api-flow/shared/constants";
import {
  Send,
  ChevronDown,
  Save,
  Settings2,
  FileCode2,
  Lock,
  Link2,
} from "lucide-react";

type TabId = "params" | "headers" | "body" | "auth";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "params", label: "Params", icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: "headers", label: "Headers", icon: <Settings2 className="w-3.5 h-3.5" /> },
  { id: "body", label: "Body", icon: <FileCode2 className="w-3.5 h-3.5" /> },
  { id: "auth", label: "Auth", icon: <Lock className="w-3.5 h-3.5" /> },
];

export function RequestBuilder() {
  const {
    activeRequest,
    isExecuting,
    setMethod,
    setUrl,
  } = useRequestStore();

  const { execute } = useApiRequest();
  const [activeTab, setActiveTab] = useState<TabId>("params");
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);

  const handleSend = useCallback(() => {
    if (!activeRequest.url.trim()) return;
    execute();
  }, [activeRequest.url, execute]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full">
      {/* ===== URL Bar ===== */}
      <div className="flex items-center gap-2 p-4 border-b border-white/5">
        {/* Method Selector */}
        <div className="relative">
          <button
            onClick={() => setShowMethodDropdown(!showMethodDropdown)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 rounded-lg",
              "bg-surface-2 border border-white/10",
              "hover:bg-surface-3 transition-all duration-200",
              "font-mono font-bold text-sm min-w-[90px]"
            )}
          >
            <MethodBadge method={activeRequest.method} size="sm" />
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {showMethodDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMethodDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-20 bg-surface-2 border border-white/10 rounded-lg shadow-xl overflow-hidden animate-scale-in">
                {HTTP_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethod(m as HttpMethod);
                      setShowMethodDropdown(false);
                    }}
                    className={cn(
                      "flex items-center w-full px-3 py-2 text-left",
                      "hover:bg-surface-3 transition-colors duration-100",
                      activeRequest.method === m && "bg-surface-3"
                    )}
                  >
                    <MethodBadge method={m as HttpMethod} size="sm" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* URL Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={activeRequest.url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter request URL or paste a cURL command..."
            className={cn(
              "w-full px-4 py-2.5 rounded-lg font-mono text-sm",
              "bg-surface-2 border border-white/10",
              "text-gray-200 placeholder-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40",
              "transition-all duration-200"
            )}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isExecuting || !activeRequest.url.trim()}
          className={cn(
            "btn-primary flex items-center gap-2 min-w-[100px] justify-center",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isExecuting && "animate-pulse"
          )}
        >
          <Send className={cn("w-4 h-4", isExecuting && "animate-spin")} />
          {isExecuting ? "Sending..." : "Send"}
        </button>

        {/* Save Button */}
        <button className="btn-ghost" title="Save request (Ctrl+S)">
          <Save className="w-4 h-4" />
        </button>
      </div>

      {/* ===== Tabs ===== */}
      <div className="flex items-center border-b border-white/5 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "tab-button flex items-center gap-1.5",
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
          </button>
        ))}
      </div>

      {/* ===== Tab Content ===== */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "params" && <QueryParams />}
        {activeTab === "headers" && <HeaderEditor />}
        {activeTab === "body" && <BodyEditor />}
        {activeTab === "auth" && <AuthConfig />}
      </div>
    </div>
  );
}
