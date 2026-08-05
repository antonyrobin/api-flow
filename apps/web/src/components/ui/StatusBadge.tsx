"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { getStatusInfo, formatBytes, formatDuration } from "@api-flow/shared";

interface StatusBadgeProps {
  statusCode: number;
  className?: string;
}

export function StatusBadge({ statusCode, className }: StatusBadgeProps) {
  const { label, color } = getStatusInfo(statusCode);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold font-mono",
        className
      )}
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}25`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {statusCode}
      <span className="text-xs font-normal opacity-70">{label}</span>
    </span>
  );
}

interface ResponseMetaProps {
  statusCode: number;
  timeMs: number;
  sizeBytes: number;
  className?: string;
}

export function ResponseMeta({
  statusCode,
  timeMs,
  sizeBytes,
  className,
}: ResponseMetaProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <StatusBadge statusCode={statusCode} />
      <span className="text-sm text-gray-400 font-mono">
        {formatDuration(timeMs)}
      </span>
      <span className="text-sm text-gray-500 font-mono">
        {formatBytes(sizeBytes)}
      </span>
    </div>
  );
}
