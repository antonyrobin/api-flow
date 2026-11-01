"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal dialog. Full-screen sheet on phones, centred card on larger screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the first field for keyboard users
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button:not([data-dialog-close])"
    );
    first?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full flex flex-col bg-surface-1 border border-line/10 shadow-2xl animate-slide-up",
          "max-h-[92dvh] rounded-t-2xl sm:rounded-2xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-100">
              {title}
            </h2>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-surface-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-line/5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
