"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Draggable divider between two panels.
 * - `axis="x"`: vertical bar, drags left/right (col-resize)
 * - `axis="y"`: horizontal bar, drags up/down (row-resize)
 * Reports the pointer position; the parent turns it into a size.
 * Keyboard: arrow keys nudge, Home/End jump, double-click resets.
 */
export function ResizeHandle({
  axis,
  onDrag,
  onNudge,
  onReset,
  label,
  valueNow,
  className,
}: {
  axis: "x" | "y";
  onDrag: (clientPos: number) => void;
  onNudge?: (direction: -1 | 1, large: boolean) => void;
  onReset?: () => void;
  label: string;
  /** 0–100, for screen readers */
  valueNow?: number;
  className?: string;
}) {
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      // Stop text selection + keep the resize cursor everywhere while dragging
      document.body.style.userSelect = "none";
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    },
    [axis]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      onDrag(axis === "x" ? e.clientX : e.clientY);
    },
    [axis, onDrag]
  );

  const stop = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onNudge) return;
    const back = axis === "x" ? "ArrowLeft" : "ArrowUp";
    const forward = axis === "x" ? "ArrowRight" : "ArrowDown";
    if (e.key === back || e.key === forward) {
      e.preventDefault();
      onNudge(e.key === back ? -1 : 1, e.shiftKey);
    } else if (e.key === "Enter" && onReset) {
      e.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuenow={valueNow !== undefined ? Math.round(valueNow) : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative shrink-0 z-10 touch-none outline-none",
        axis === "x" ? "w-1.5 -mx-[3px] cursor-col-resize" : "h-1.5 -my-[3px] cursor-row-resize",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute transition-colors bg-line/5 group-hover:bg-brand-500/60 group-focus-visible:bg-brand-500 group-active:bg-brand-500",
          axis === "x" ? "inset-y-0 left-1/2 w-px -translate-x-1/2 group-hover:w-0.5" : "inset-x-0 top-1/2 h-px -translate-y-1/2 group-hover:h-0.5"
        )}
      />
    </div>
  );
}
