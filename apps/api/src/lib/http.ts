/**
 * Outbound HTTP helper shared by the proxy, monitors and scheduler.
 *
 * Guards against the API being used to reach internal infrastructure (SSRF):
 * - only http/https URLs
 * - blocks loopback, private, link-local and metadata addresses
 * - re-validates every redirect hop instead of following blindly
 * - caps the response size kept in memory
 */

export class OutboundRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundRequestError";
  }
}

export interface SafeFetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string | null;
  timeoutMs: number;
  /** Maximum response body bytes kept; the rest is discarded. */
  maxBytes: number;
  maxRedirects?: number;
  /** Allow localhost / private networks (local development only). */
  allowPrivateHosts?: boolean;
}

export interface SafeFetchResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  sizeBytes: number;
  truncated: boolean;
  finalUrl: string;
  ttfbMs: number;
  downloadMs: number;
}

const METHODS_WITH_BODY = ["POST", "PUT", "PATCH", "DELETE"];

// Headers the caller may not set on the outbound request
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return null;
  return nums;
}

function isPrivateIPv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(h)) return true; // link-local
  if (h.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1)
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const v4 = parseIPv4(mapped[1]!);
    if (v4) return isPrivateIPv4(v4);
    return true; // hex-form mapped addresses: block conservatively
  }
  return false;
}

/**
 * Validate a URL for outbound use. Throws OutboundRequestError when blocked.
 */
export function assertSafeUrl(rawUrl: string, allowPrivateHosts = false): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OutboundRequestError("Invalid URL. Include the protocol, e.g. https://api.example.com");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OutboundRequestError("Only http:// and https:// URLs are supported");
  }

  if (url.username || url.password) {
    throw new OutboundRequestError("Credentials in the URL are not allowed. Use the Auth tab instead.");
  }

  if (allowPrivateHosts) return url;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    BLOCKED_HOSTNAMES.has(host) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new OutboundRequestError("Requests to local or internal hosts are not allowed");
  }

  const v4 = parseIPv4(host);
  if (v4 && isPrivateIPv4(v4)) {
    throw new OutboundRequestError("Requests to private IP addresses are not allowed");
  }

  if (host.includes(":") && isPrivateIPv6(host)) {
    throw new OutboundRequestError("Requests to private IP addresses are not allowed");
  }

  // Decimal / hex encoded IPv4 hosts (e.g. http://2130706433/) are an SSRF trick
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) {
    throw new OutboundRequestError("Numeric host names are not allowed");
  }

  return url;
}

function sanitizeHeaders(headers: Record<string, string> = {}): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    const name = key.trim();
    if (!name || STRIPPED_REQUEST_HEADERS.has(name.toLowerCase())) continue;
    try {
      result.set(name, value);
    } catch {
      throw new OutboundRequestError(`Invalid header: ${name}`);
    }
  }
  return result;
}

async function readCapped(
  response: Response,
  maxBytes: number
): Promise<{ text: string; sizeBytes: number; truncated: boolean }> {
  if (!response.body) return { text: "", sizeBytes: 0, truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let kept = 0;
  let sizeBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sizeBytes += value.byteLength;
    if (kept < maxBytes) {
      const slice = value.subarray(0, Math.min(value.byteLength, maxBytes - kept));
      chunks.push(slice);
      kept += slice.byteLength;
    }
    if (sizeBytes > maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }

  const merged = new Uint8Array(kept);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder().decode(merged),
    sizeBytes,
    truncated,
  };
}

/**
 * fetch() with SSRF protection, manual redirect validation and a size cap.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 5;
  const signal = AbortSignal.timeout(options.timeoutMs);
  const headers = sanitizeHeaders(options.headers);

  let method = options.method.toUpperCase();
  let body = options.body && METHODS_WITH_BODY.includes(method) ? options.body : undefined;
  let url = assertSafeUrl(rawUrl, options.allowPrivateHosts);

  const start = Date.now();

  for (let hop = 0; ; hop++) {
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body,
        redirect: "manual",
        signal,
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new OutboundRequestError(`Request timed out after ${options.timeoutMs} ms`);
      }
      throw new OutboundRequestError(
        err instanceof Error ? err.message : "Network error"
      );
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop >= maxRedirects) {
        throw new OutboundRequestError(`Too many redirects (max ${maxRedirects})`);
      }
      await response.body?.cancel();
      url = assertSafeUrl(new URL(location, url).toString(), options.allowPrivateHosts);
      // Per the fetch spec, 303 (and 301/302 for POST) switch to GET without a body
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
        headers.delete("content-type");
      }
      continue;
    }

    const ttfbMs = Date.now() - start;
    const downloadStart = Date.now();
    const { text, sizeBytes, truncated } = await readCapped(response, options.maxBytes);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      sizeBytes,
      truncated,
      finalUrl: url.toString(),
      ttfbMs,
      downloadMs: Date.now() - downloadStart,
    };
  }
}
