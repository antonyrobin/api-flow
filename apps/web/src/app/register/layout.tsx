import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a free account",
  description:
    "Create a free API Flow account to save API requests and run heartbeat health checks on multiple endpoints.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
