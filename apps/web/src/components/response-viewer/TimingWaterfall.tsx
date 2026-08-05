"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@api-flow/shared";
import type { RequestTiming } from "@api-flow/shared";

interface TimingWaterfallProps {
  timing: RequestTiming;
  className?: string;
}

interface TimingPhase {
  label: string;
  key: keyof RequestTiming;
  color: string;
  description: string;
}

const PHASES: TimingPhase[] = [
  {
    label: "DNS Lookup",
    key: "dnsMs",
    color: "#06b6d4",
    description: "Domain name resolution",
  },
  {
    label: "TCP Connect",
    key: "tcpMs",
    color: "#f59e0b",
    description: "TCP connection establishment",
  },
  {
    label: "TLS Handshake",
    key: "tlsMs",
    color: "#a855f7",
    description: "TLS/SSL negotiation",
  },
  {
    label: "TTFB",
    key: "ttfbMs",
    color: "#22c55e",
    description: "Time to first byte (server processing)",
  },
  {
    label: "Download",
    key: "downloadMs",
    color: "#3b82f6",
    description: "Response body transfer",
  },
];

export function TimingWaterfall({ timing, className }: TimingWaterfallProps) {
  const totalMs = timing.totalMs || 1;

  // Calculate cumulative offsets for waterfall positioning
  let offset = 0;
  const bars = PHASES.map((phase) => {
    const value = (timing[phase.key] as number) || 0;
    const width = (value / totalMs) * 100;
    const left = (offset / totalMs) * 100;
    offset += value;
    return { ...phase, value, width, left };
  });

  return (
    <div className={cn("space-y-6", className)}>
      {/* Total Time Display */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Request Timing</h3>
        <div className="text-right">
          <span className="text-2xl font-bold font-mono text-gray-100">
            {formatDuration(totalMs)}
          </span>
          <span className="text-xs text-gray-500 ml-2">total</span>
        </div>
      </div>

      {/* Waterfall Bars */}
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.key} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: bar.color }}
                />
                <span className="text-sm text-gray-300">{bar.label}</span>
                <span className="text-2xs text-gray-600 hidden group-hover:inline">
                  {bar.description}
                </span>
              </div>
              <span className="text-sm font-mono text-gray-400">
                {bar.value > 0 ? formatDuration(bar.value) : "—"}
              </span>
            </div>

            {/* Bar */}
            <div className="h-5 bg-surface-2 rounded-md overflow-hidden relative">
              {bar.value > 0 && (
                <div
                  className="h-full rounded-md transition-all duration-500 ease-out"
                  style={{
                    backgroundColor: `${bar.color}40`,
                    borderLeft: `3px solid ${bar.color}`,
                    width: `${Math.max(bar.width, 2)}%`,
                    marginLeft: `${bar.left}%`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2/50"
          >
            <div
              className="w-1.5 h-6 rounded-full"
              style={{ backgroundColor: bar.color }}
            />
            <div>
              <div className="text-2xs text-gray-500">{bar.label}</div>
              <div className="text-sm font-mono text-gray-300">
                {bar.value > 0 ? formatDuration(bar.value) : "N/A"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
