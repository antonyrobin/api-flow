"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { signIn, sendVerificationEmail } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/config";
import { AuthShell, FormAlert, SocialSignIn } from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to save requests and monitor your APIs">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const verified = searchParams.get("verified") === "1";
  const reset = searchParams.get("reset") === "1";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? "Social sign-in failed or was cancelled. Please try again." : null
  );
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const resendVerification = async () => {
    setResendState("sending");
    const { error } = await sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/login?verified=1&next=${encodeURIComponent(next)}`,
    });
    if (error) {
      setResendState("idle");
      setError(
        error.status === 429
          ? "Please wait a minute before requesting another email."
          : error.message || "Could not send the email."
      );
      return;
    }
    setResendState("sent");
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setNeedsVerification(false);
    try {
      const { error } = await signIn.email({ email, password, rememberMe: true });
      if (error) {
        setNeedsVerification(error.status === 403);
        setError(
          error.status === 403
            ? "Please verify your email address first. Check your inbox for the verification link."
            : error.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : error.message || "Invalid email or password."
        );
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setError(null);
    const { error } = await signIn.social({
      provider,
      // Absolute URL: the OAuth callback is served by the API origin
      callbackURL: `${window.location.origin}${next}`,
      errorCallbackURL: `${window.location.origin}/login`,
      newUserCallbackURL: `${window.location.origin}${next}`,
    });
    if (error) setError(error.message || `${provider} sign-in is not available right now.`);
  };

  return (
    <>
      {verified && <FormAlert tone="success">Email verified — you can sign in now.</FormAlert>}
      {reset && <FormAlert tone="success">Password updated — sign in with your new password.</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      {needsVerification && (
        <div className="-mt-2 mb-4 text-sm">
          {resendState === "sent" ? (
            <p className="text-emerald-300">Verification email sent — check your inbox (and spam folder).</p>
          ) : (
            <button
              type="button"
              onClick={resendVerification}
              disabled={resendState === "sending"}
              className="text-brand-400 hover:text-brand-300 font-medium disabled:opacity-60"
            >
              {resendState === "sending" ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      )}

      <SocialSignIn
        verb="Continue"
        dividerLabel="or sign in with email"
        onSelect={handleSocialLogin}
        disabled={isLoading}
      />

      <form onSubmit={handleEmailLogin} className="space-y-4" noValidate={false}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full input-field pl-10"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full input-field pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary py-3 text-sm disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href={next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="text-brand-400 hover:text-brand-300 font-medium"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
