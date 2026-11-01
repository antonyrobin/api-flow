/**
 * Writes out/_headers for Cloudflare Pages after `next build` (static export).
 * Mirrors the headers next.config.ts sends in development, with the production CSP
 * pointing connect-src at NEXT_PUBLIC_API_URL.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "out");

// Same precedence Next.js uses for production builds
for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl || /localhost|127\.0\.0\.1/.test(apiUrl)) {
  console.error(
    "\n✖ NEXT_PUBLIC_API_URL is not set to your deployed API (got: " + (apiUrl || "nothing") + ").\n" +
      "  Create apps/web/.env.production.local (see .env.production.example) and rebuild.\n"
  );
  process.exit(1);
}
if (!existsSync(outDir)) {
  console.error("✖ out/ not found — run `next build` first.");
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${new URL(apiUrl).origin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

# Metadata images are exported without a file extension
/apple-icon
  Content-Type: image/png
/opengraph-image
  Content-Type: image/png
/twitter-image
  Content-Type: image/png
`;

writeFileSync(resolve(outDir, "_headers"), headers);
console.log(`✓ Wrote out/_headers (API origin ${new URL(apiUrl).origin})`);
