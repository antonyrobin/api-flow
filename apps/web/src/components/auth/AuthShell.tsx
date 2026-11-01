"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-dvh bg-surface-0 flex items-center justify-center px-4 py-10 sm:py-16">
      {/* Background gradient */}
      <div
        aria-hidden
        className="fixed inset-0 bg-gradient-to-br from-brand-950/50 via-surface-0 to-brand-950/30"
      />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-6 sm:mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Back to workspace
        </Link>

        <div className="glass-card p-6 sm:p-8 glow-brand">
          <div className="flex justify-center mb-6 sm:mb-8">
            <Logo size="lg" />
          </div>

          <h1 className="text-xl font-semibold text-center text-gray-100 mb-2">{title}</h1>
          <p className="text-sm text-gray-500 text-center mb-6 sm:mb-8">{subtitle}</p>

          {children}
        </div>
      </div>
    </main>
  );
}

export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-4 px-3 py-2.5 rounded-lg text-sm border",
        tone === "error"
          ? "bg-red-500/10 border-red-500/20 text-red-300"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
      )}
    >
      {children}
    </div>
  );
}

const socialButtonClass = cn(
  "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg",
  "bg-white text-[#111827] font-medium text-sm border border-line/10",
  "hover:bg-[#f3f4f6] transition-all duration-200 active:scale-[0.98]",
  "disabled:opacity-60 disabled:cursor-not-allowed"
);

type Providers = { google: boolean; apple: boolean };

/** Which social providers the API has credentials for (GET /auth/providers) */
export function useSocialProviders(): Providers | null {
  const [providers, setProviders] = useState<Providers | null>(null);
  useEffect(() => {
    apiFetch<{ data: Providers }>("/auth/providers")
      .then((r) => setProviders(r.data))
      .catch(() => setProviders({ google: false, apple: false }));
  }, []);
  return providers;
}

/**
 * Google / Apple buttons. Only providers configured on the API are shown, so users
 * never hit "Provider not found"; nothing (not even the divider) renders when none are.
 */
export function SocialSignIn({
  verb,
  dividerLabel,
  onSelect,
  disabled,
}: {
  verb: "Continue" | "Sign up";
  dividerLabel: string;
  onSelect: (provider: "google" | "apple") => void;
  disabled?: boolean;
}) {
  const providers = useSocialProviders();
  if (!providers) return <div className="h-[52px] mb-6 rounded-lg bg-surface-2 animate-pulse" aria-hidden />;
  if (!providers.google && !providers.apple) return null;
  return (
    <>
      <SocialButtons verb={verb} onSelect={onSelect} disabled={disabled} providers={providers} />
      <Divider label={dividerLabel} />
    </>
  );
}

export function SocialButtons({
  verb,
  onSelect,
  disabled,
  providers = { google: true, apple: true },
}: {
  verb: "Continue" | "Sign up";
  onSelect: (provider: "google" | "apple") => void;
  disabled?: boolean;
  providers?: Providers;
}) {
  return (
    <div className="space-y-3">
      {providers.google && (
      <button
        type="button"
        onClick={() => onSelect("google")}
        disabled={disabled}
        className={socialButtonClass}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {verb} with Google
      </button>
      )}

      {providers.apple && (
      <button
        type="button"
        onClick={() => onSelect("apple")}
        disabled={disabled}
        className={socialButtonClass}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        {verb} with Apple
      </button>
      )}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-line/10" />
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex-1 h-px bg-line/10" />
    </div>
  );
}
