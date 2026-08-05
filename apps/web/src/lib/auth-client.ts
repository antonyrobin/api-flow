import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for React.
 * Provides hooks and methods for authentication flows.
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787",
  basePath: "/auth",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
