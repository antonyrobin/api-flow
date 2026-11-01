"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; hint: string; icon: typeof Sun; swatch: string[] }[] = [
  { id: "system", label: "System", hint: "Match your OS", icon: Monitor, swatch: ["#0a0a0f", "#f3f5f8"] },
  { id: "dark", label: "Dark", hint: "Midnight", icon: Moon, swatch: ["#0a0a0f", "#1a1a25", "#14b8a6"] },
  { id: "light", label: "Light", hint: "Paper", icon: Sun, swatch: ["#ffffff", "#ecf0f3", "#0d9488"] },
  { id: "ocean", label: "Ocean", hint: "Deep teal", icon: Waves, swatch: ["#001e27", "#04333f", "#22d3ee"] },
];

/** Header button + popover to choose Dark / Light / System / Ocean */
export function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const CurrentIcon = resolved === "light" ? Sun : resolved === "ocean" ? Waves : Moon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        title="Theme"
        className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors"
      >
        <CurrentIcon className="w-4 h-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 mt-2 w-56 z-50 glass-card bg-surface-2 shadow-xl p-1.5 animate-scale-in"
        >
          <p className="flex items-center gap-1.5 px-2.5 pt-1 pb-2 text-2xs uppercase tracking-wider text-gray-500">
            <Palette className="w-3 h-3" aria-hidden /> Theme
          </p>
          {OPTIONS.map(({ id, label, hint, icon: Icon, swatch }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={preference === id}
              onClick={() => {
                setPreference(id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors",
                preference === id ? "bg-brand-600/15 text-brand-300" : "text-gray-300 hover:bg-surface-3"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="block">{label}</span>
                <span className="block text-2xs text-gray-500">{hint}</span>
              </span>
              <span className="flex -space-x-1" aria-hidden>
                {swatch.map((c) => (
                  <span key={c} className="w-3.5 h-3.5 rounded-full border border-line/20" style={{ background: c }} />
                ))}
              </span>
              <Check className={cn("w-3.5 h-3.5 shrink-0", preference === id ? "opacity-100" : "opacity-0")} aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
