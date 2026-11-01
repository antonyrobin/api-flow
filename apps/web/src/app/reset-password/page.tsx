"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { resetPassword } from "@/lib/auth-client";
import { AuthShell, FormAlert } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="All other sessions will be signed out">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || linkError) {
    return (
      <div className="text-center space-y-6">
        <FormAlert>This reset link is invalid or has expired.</FormAlert>
        <Link href="/forgot-password" className="btn-primary inline-block">
          Request a new link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await resetPassword({ newPassword: password, token });
      if (error) {
        setError(
          error.status === 400
            ? "This reset link is invalid or has expired. Request a new one."
            : error.message || "Could not reset your password."
        );
        return;
      }
      router.replace("/login?reset=1");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && <FormAlert>{error}</FormAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {(["password", "confirm"] as const).map((field) => (
          <div key={field}>
            <label htmlFor={field} className="block text-sm font-medium text-gray-300 mb-1.5">
              {field === "password" ? "New password" : "Confirm password"}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden />
              <input
                id={field}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={field === "password" ? password : confirm}
                onChange={(e) => (field === "password" ? setPassword : setConfirm)(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                maxLength={128}
                required
                className="w-full input-field pl-10 pr-10"
              />
              {field === "password" && (
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="submit" disabled={isLoading} className="w-full btn-primary py-3 text-sm disabled:opacity-60">
          {isLoading ? "Saving..." : "Set new password"}
        </button>
      </form>
    </>
  );
}
