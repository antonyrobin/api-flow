"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SplitDirection = "horizontal" | "vertical";

interface LayoutStore {
  /** Saved-requests sidebar visible on desktop */
  sidebarOpen: boolean;
  sidebarWidth: number;
  /** Response panel visible */
  responseOpen: boolean;
  /** horizontal = request | response side by side; vertical = stacked */
  splitDirection: SplitDirection | null;
  /** Fraction of the split given to the request panel (0..1) */
  splitRatio: number;

  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleResponse: () => void;
  setResponseOpen: (open: boolean) => void;
  setSplitDirection: (direction: SplitDirection) => void;
  setSplitRatio: (ratio: number) => void;
  resetSplit: () => void;
}

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 520;
export const SIDEBAR_DEFAULT = 272;
export const SPLIT_MIN = 0.15;
export const SPLIT_MAX = 0.85;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Workspace panel layout, remembered per browser.
 * Hydrated manually (see Workspace) to keep the server render deterministic.
 */
export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT,
      responseOpen: true,
      // null = pick by screen width (side by side on very wide screens)
      splitDirection: null,
      splitRatio: 0.5,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: clamp(Math.round(width), SIDEBAR_MIN, SIDEBAR_MAX) }),
      toggleResponse: () => set((s) => ({ responseOpen: !s.responseOpen })),
      setResponseOpen: (responseOpen) => set({ responseOpen }),
      setSplitDirection: (splitDirection) => set({ splitDirection }),
      setSplitRatio: (ratio) => set({ splitRatio: clamp(ratio, SPLIT_MIN, SPLIT_MAX) }),
      resetSplit: () => set({ splitRatio: 0.5 }),
    }),
    { name: "apiflow-layout", skipHydration: true, version: 1 }
  )
);
