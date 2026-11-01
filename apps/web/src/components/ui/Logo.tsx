import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  showVersion = false,
  className,
}: {
  size?: "md" | "lg";
  showVersion?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="API Flow home"
      className={cn("flex items-center gap-2.5 shrink-0", className)}
    >
      <LogoMark className={cn("shadow-lg shadow-brand-500/20 rounded-lg", size === "lg" ? "w-10 h-10 rounded-xl" : "w-8 h-8")} />
      <span className="flex flex-col leading-tight">
        <span className={cn("font-bold gradient-text", size === "lg" ? "text-xl" : "text-sm")}>
          API Flow
        </span>
        {showVersion && <span className="text-2xs text-gray-500">v0.1.0</span>}
      </span>
    </Link>
  );
}

/** App mark: a request node flowing into a response arrow (same artwork as app/icon.svg) */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="apiflow-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="0.55" stopColor="#0891b2" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#apiflow-mark)" />
      <circle cx="16" cy="20" r="5.5" fill="#fff" />
      <path d="M21 20h6c11 0 1 24 12 24h3" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 36.5 50 44l-9 7.5z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="46" cy="18" r="3" fill="#99f6e4" />
    </svg>
  );
}
