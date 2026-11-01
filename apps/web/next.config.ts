import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 * The browser only ever talks to this site and the API Flow API — user requests
 * to third-party APIs go through the API proxy, so connect-src stays narrow.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // OAuth avatars (Google/Apple) are remote images
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${new URL(apiUrl).origin}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

/**
 * Production builds are a static export (`out/`) served by Cloudflare Pages:
 * every page is client-rendered, so no server runtime is needed and the build
 * works on any OS. Security headers for production are written to `out/_headers`
 * by scripts/write-pages-headers.mjs; `headers()`/`rewrites()` only apply to `next dev`.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@api-flow/shared"],
  ...(isDev
    ? {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }
    : {
        output: "export",
        // No image optimisation server on a static host
        images: { unoptimized: true },
      }),
};

export default nextConfig;
