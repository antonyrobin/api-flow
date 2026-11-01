"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { signIn, signUp, sendVerificationEmail } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/config";
import { AuthShell, FormAlert, SocialSignIn } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const verifyCallback = () =>
    `${window.location.origin}/login?verified=1&next=${encodeURIComponent(next)}`;

  const resend = async () => {
    setResendState("sending");
    const { error } = await sendVerificationEmail({ email, callbackURL: verifyCallback() });
    setResendState(error ? "error" : "sent");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await signUp.email({
        name: name.trim(),
        email,
        password,
        // Where the verification link lands after the email is confirmed
        callbackURL: verifyCallback(),
      });
      if (error) {
        setError(
          error.status === 422 || error.code === "USER_ALREADY_EXISTS"
            ? "An account with this email already exists. Try signing in instead."
            : error.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : error.message || "Registration failed. Please try again."
        );
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocial = async (provider: "google" | "apple") => {
    setError(null);
    const { error } = await signIn.social({
      provider,
      callbackURL: `${window.location.origin}${next}`,
      errorCallbackURL: `${window.location.origin}/register`,
      newUserCallbackURL: `${window.location.origin}${next}`,
    });
    if (error) setError(error.message || `${provider} sign-up is not available right now.`);
  };

  if (success) {
    return (
      <AuthShell title="Check your email" subtitle="One more step to activate your account">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-brand-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/25">
            <Mail className="w-7 h-7 text-white" aria-hidden />
          </div>
          <p className="text-gray-400 text-sm mb-6">
            We&apos;ve sent a verification link to{" "}
            <strong className="text-gray-200 break-all">{email}</strong>. Please verify your email
            to complete registration.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Back to Sign In
          </Link>
          <p className="text-xs text-gray-500 mt-6">
            Didn&apos;t get it?{" "}
            {resendState === "sent" ? (
              <span className="text-emerald-300">Sent again — check your spam folder too.</span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={resendState === "sending"}
                className="text-brand-400 hover:text-brand-300 font-medium disabled:opacity-60"
              >
                {resendState === "sending" ? "Sending…" : resendState === "error" ? "Try again" : "Resend email"}
              </button>
            )}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free account to save requests and monitor endpoints"
    >
      {error && <FormAlert>{error}</FormAlert>}

      <SocialSignIn
        verb="Sign up"
        dividerLabel="or register with email"
        onSelect={handleSocial}
        disabled={isLoading}
      />

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              required
              className="w-full input-field pl-10"
            />
          </div>
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              maxLength={128}
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
          {isLoading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
