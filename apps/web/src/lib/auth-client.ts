import { createAuthClient } from "better-auth/react";
import { API_URL } from "./config";

/**
 * Better Auth client for React.
 * Provides hooks and methods for authentication flows.
 * basePath must match `basePath` in apps/api/src/lib/auth.ts.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
