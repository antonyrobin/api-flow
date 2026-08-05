"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@api-flow/shared/constants";
import type { HttpMethod } from "@api-flow/shared/constants";

interface MethodBadgeProps {
  method: HttpMethod;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MethodBadge({ method, size = "md", className }: MethodBadgeProps) {
  const color = METHOD_COLORS[method];

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-2xs",
    md: "px-2 py-0.5 text-xs",
    lg: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "font-bold uppercase tracking-wider rounded font-mono",
        sizeClasses[size],
        className
      )}
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      {method}
    </span>
  );
}
