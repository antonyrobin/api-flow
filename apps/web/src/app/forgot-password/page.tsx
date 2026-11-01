"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth-client";
import { AuthShell, FormAlert } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await requestPasswordReset({
        email,
        // The emailed link verifies the token on the API, then lands here with ?token=
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(
          error.status === 429
            ? "Too many requests. Please wait a minute and try again."
            : error.message || "Could not send the reset email."
        );
        return;
      }
      // Same message whether or not the account exists (no account enumeration)
      setSent(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one">
      {sent ? (
        <div className="text-center space-y-6">
          <FormAlert tone="success">
            If an account exists for <strong className="break-all">{email}</strong>, a reset link is on its way. It
            expires in 1 hour.
          </FormAlert>
          <Link href="/login" className="btn-primary inline-block">
            Back to Sign In
          </Link>
        </div>
      ) : (
        <>
          {error && <FormAlert>{error}</FormAlert>}
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-3 text-sm disabled:opacity-60">
              {isLoading ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-6">
            Remembered it?{" "}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
