"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Plus, X, XSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_TABS, snapshotTabs, useRequestStore } from "@/stores/request-store";
import { MethodBadge } from "@/components/ui/MethodBadge";

/**
 * Browser-style tab strip for open requests.
 * Middle-click closes, right-click offers duplicate / close others.
 * Shortcuts: Alt+T new tab, Alt+W close tab, Ctrl+Tab / Ctrl+Shift+Tab cycle.
 */
export function RequestTabs() {
  const state = useRequestStore();
  const { activeTabId, newTab, switchTab, closeTab, closeOtherTabs, duplicateTab } = state;
  const tabs = snapshotTabs(state);
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active tab in view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { tabs: list, activeTabId: current } = useRequestStore.getState();
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        newTab();
      } else if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        closeTab(current);
      } else if (e.ctrlKey && e.key === "Tab" && list.length > 1) {
        e.preventDefault();
        const index = list.findIndex((t) => t.id === current);
        const next = (index + (e.shiftKey ? -1 : 1) + list.length) % list.length;
        switchTab(list[next].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTab, closeTab, switchTab]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const confirmClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.dirty && tab.request.url.trim()) {
      if (!window.confirm(`"${tab.request.name}" has unsaved changes. Close it anyway?`)) return;
    }
    closeTab(tabId);
  };

  return (
    <div className="flex items-stretch h-10 shrink-0 border-b border-line/5 bg-surface-1/40">
      <div role="tablist" aria-label="Open requests" className="flex items-stretch min-w-0 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const title = tabTitle(tab.request.name, tab.request.url);
          return (
            <div
              key={tab.id}
              className={cn(
                "group relative flex items-center shrink-0 max-w-[220px] border-r border-line/5",
                active ? "bg-surface-0 text-gray-100" : "text-gray-400 hover:bg-surface-2/60 hover:text-gray-200"
              )}
              onAuxClick={(e) => e.button === 1 && confirmClose(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
            >
              {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand-500" />}
              <button
                ref={active ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(tab.id)}
                title={tab.request.url || title}
                className="flex items-center gap-2 pl-3 pr-1 h-full min-w-0 text-xs"
              >
                {tab.isExecuting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-brand-400 shrink-0" aria-label="Sending" />
                ) : (
                  <MethodBadge method={tab.request.method} size="sm" className="shrink-0 !px-1 !py-0 !text-[9px]" />
                )}
                <span className="truncate">{title}</span>
                {tab.dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-label="unsaved changes" />
                )}
              </button>
              <button
                type="button"
                onClick={() => confirmClose(tab.id)}
                aria-label={`Close ${title}`}
                className={cn(
                  "mr-1.5 p-0.5 rounded text-gray-500 hover:text-gray-200 hover:bg-surface-4",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => newTab()}
        disabled={tabs.length >= MAX_TABS}
        aria-label="New tab"
        title="New tab (Alt+T)"
        className="shrink-0 px-3 text-gray-400 hover:text-gray-200 hover:bg-surface-2/60 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
      </button>

      {menu && (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 w-44 glass-card bg-surface-2 shadow-xl p-1 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Duplicate", icon: Copy, run: () => duplicateTab(menu.tabId) },
            { label: "Close", icon: X, run: () => confirmClose(menu.tabId) },
            { label: "Close others", icon: XSquare, run: () => closeOtherTabs(menu.tabId) },
          ].map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                run();
                setMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-300 hover:bg-surface-3"
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Untitled tabs are labelled by their URL path, like a browser tab */
function tabTitle(name: string, url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "New request";
  if (name && name !== "Untitled Request") return name;
  const path = trimmed.replace(/^[a-z][a-z\d+.-]*:\/\//i, "").replace(/\?.*$/, "");
  const slash = path.indexOf("/");
  return slash === -1 || slash === path.length - 1 ? path : path.slice(slash);
}
