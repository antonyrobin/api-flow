"use client";

import React, { useEffect, useRef, useState } from "react";
import { Columns2, PanelBottomClose, PanelBottomOpen, PanelRightClose, PanelRightOpen, Rows2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RequestBuilder } from "@/components/request-builder/RequestBuilder";
import { ResponseViewer } from "@/components/response-viewer/ResponseViewer";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useRequestStore } from "@/stores/request-store";
import { useShallow } from "zustand/react/shallow";
import { useLayoutStore } from "@/stores/layout-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { SavedRequestsSidebar } from "./SavedRequestsSidebar";
import { RequestTabs } from "./RequestTabs";
import { BackupDialog } from "./BackupDialog";

/**
 * Main API testing workspace.
 * Works for both guests (test, multiple tabs) and authenticated users (save, import, backup, monitor).
 *
 * Layout:
 * - phones / tablets: request and response stack and the page scrolls
 * - lg+: resizable split — stacked or side by side (auto: side by side from 2xl),
 *   and the response panel can be hidden
 */
export function Workspace() {
  const [backupOpen, setBackupOpen] = useState(false);
  const isExecuting = useRequestStore((s) => s.isExecuting);
  // Sidebar width changes (drag) shouldn't re-render the whole workspace
  const { responseOpen, splitDirection, splitRatio, toggleResponse, setResponseOpen, setSplitDirection, setSplitRatio, resetSplit } =
    useLayoutStore(
      useShallow((s) => ({
        responseOpen: s.responseOpen,
        splitDirection: s.splitDirection,
        splitRatio: s.splitRatio,
        toggleResponse: s.toggleResponse,
        setResponseOpen: s.setResponseOpen,
        setSplitDirection: s.setSplitDirection,
        setSplitRatio: s.setSplitRatio,
        resetSplit: s.resetSplit,
      }))
    );
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isWide = useMediaQuery("(min-width: 1536px)");
  const splitRef = useRef<HTMLDivElement>(null);

  // Restore open tabs (saved per browser) after hydration
  useEffect(() => {
    void useRequestStore.persist.rehydrate();
  }, []);

  // Sending a request always reveals the response panel
  useEffect(() => {
    if (isExecuting) setResponseOpen(true);
  }, [isExecuting, setResponseOpen]);

  const direction = splitDirection ?? (isWide ? "horizontal" : "vertical");
  const horizontal = direction === "horizontal";
  const split = isDesktop && responseOpen;

  const onDrag = (pos: number) => {
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSplitRatio(horizontal ? (pos - rect.left) / rect.width : (pos - rect.top) / rect.height);
  };

  const ResponseIcon = horizontal
    ? responseOpen ? PanelRightClose : PanelRightOpen
    : responseOpen ? PanelBottomClose : PanelBottomOpen;

  return (
    <AppShell sidebar={<SavedRequestsSidebar onOpenBackup={() => setBackupOpen(true)} />} onOpenBackup={() => setBackupOpen(true)}>
      <div className="flex items-stretch shrink-0">
        <div className="flex-1 min-w-0">
          <RequestTabs />
        </div>
        <div className="hidden lg:flex items-center gap-0.5 px-2 border-b border-l border-line/5 bg-surface-1/40">
          <button
            type="button"
            onClick={() => setSplitDirection(horizontal ? "vertical" : "horizontal")}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-3"
            aria-label={horizontal ? "Stack request and response" : "Show request and response side by side"}
            title={horizontal ? "Stack vertically" : "Side by side"}
          >
            {horizontal ? <Rows2 className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleResponse}
            aria-pressed={responseOpen}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-3"
            aria-label={responseOpen ? "Hide response panel" : "Show response panel"}
            title={responseOpen ? "Hide response (Ctrl+J)" : "Show response (Ctrl+J)"}
          >
            <ResponseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ToggleResponseShortcut onToggle={toggleResponse} />

      <div
        ref={splitRef}
        className={cn(
          "flex-1 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden",
          horizontal && "lg:flex-row"
        )}
      >
        <section
          aria-label="Request"
          style={split ? { flexBasis: `${splitRatio * 100}%` } : undefined}
          className={cn(
            "shrink-0 lg:min-h-0 lg:min-w-0",
            split ? "lg:grow-0 lg:shrink-0" : "lg:flex-1",
            !isDesktop && "border-b border-line/5"
          )}
        >
          <RequestBuilder />
        </section>

        {split && (
          <ResizeHandle
            axis={horizontal ? "x" : "y"}
            label="Resize request and response panels"
            valueNow={splitRatio * 100}
            onDrag={onDrag}
            onNudge={(dir, large) => setSplitRatio(splitRatio + dir * (large ? 0.1 : 0.02))}
            onReset={resetSplit}
          />
        )}

        {(responseOpen || !isDesktop) && (
          <section
            aria-label="Response"
            className={cn(
              "shrink-0 min-h-[320px] lg:min-h-0 lg:min-w-0 lg:flex-1",
              isDesktop && (horizontal ? "border-l border-line/5" : "border-t border-line/5")
            )}
          >
            <ResponseViewer />
          </section>
        )}
      </div>

      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
    </AppShell>
  );
}

function ToggleResponseShortcut({ onToggle }: { onToggle: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);
  return null;
}
