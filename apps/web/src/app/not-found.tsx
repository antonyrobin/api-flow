import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold gradient-text font-mono">404</p>
      <h1 className="text-lg font-semibold text-gray-100">This page could not be found</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        The page you are looking for does not exist or has moved.
      </p>
      <Link href="/" className="btn-primary text-sm">
        Open the API workspace
      </Link>
    </main>
  );
}
