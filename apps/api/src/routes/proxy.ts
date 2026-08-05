import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDb, requestHistory } from "@api-flow/db";
import { executeRequestSchema } from "@api-flow/shared/validators";
import { nanoid, nowISO } from "@api-flow/shared";
import type { Env } from "../types";
import { optionalAuth } from "../middleware/auth";

export const proxyRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } | null };
}>();

// Proxy works for both authenticated and guest users
proxyRoutes.use("*", optionalAuth);

// ============================================
// POST /proxy/execute — Execute an API request
// ============================================
proxyRoutes.post(
  "/execute",
  zValidator("json", executeRequestSchema as any),
  async (c) => {
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const body = c.req.valid("json") as any;

    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseHeaders: Record<string, string> = {};
    let responseBody = "";
    let responseSizeBytes = 0;
    let errorMessage: string | undefined;

    // Timing breakdown
    const timing = {
      dnsMs: 0,
      tcpMs: 0,
      tlsMs: 0,
      ttfbMs: 0,
      downloadMs: 0,
      totalMs: 0,
    };

    try {
      // Build headers
      const requestHeaders = new Headers(body.headers);

      // Build fetch options
      const fetchOptions: RequestInit = {
        method: body.method,
        headers: requestHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(body.timeout),
      };

      // Attach body for methods that support it
      if (body.body && ["POST", "PUT", "PATCH"].includes(body.method)) {
        fetchOptions.body = body.body;
      }

      // Execute the request
      const ttfbStart = Date.now();
      const response = await fetch(body.url, fetchOptions);
      timing.ttfbMs = Date.now() - ttfbStart;

      statusCode = response.status;

      // Capture response headers
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Read response body
      const downloadStart = Date.now();
      responseBody = await response.text();
      timing.downloadMs = Date.now() - downloadStart;
      responseSizeBytes = new TextEncoder().encode(responseBody).length;
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
    }

    timing.totalMs = Date.now() - startTime;

    // Store history entry (only for authenticated users)
    if (user) {
      try {
        await db.insert(requestHistory).values({
          id: nanoid(),
          userId: user.id,
          method: body.method,
          url: body.url,
          statusCode: statusCode ?? null,
          responseSizeBytes,
          timingDnsMs: timing.dnsMs,
          timingTcpMs: timing.tcpMs,
          timingTlsMs: timing.tlsMs,
          timingTtfbMs: timing.ttfbMs,
          timingTotalMs: timing.totalMs,
          errorMessage: errorMessage ?? null,
          createdAt: nowISO(),
        });
      } catch (dbErr) {
        console.error("[Proxy] Failed to store history:", dbErr);
      }
    }

    return c.json({
      data: {
        statusCode,
        statusText: statusCode
          ? getStatusText(statusCode)
          : undefined,
        headers: responseHeaders,
        body: responseBody,
        bodySize: responseSizeBytes,
        timing,
        error: errorMessage,
        timestamp: nowISO(),
      },
    });
  }
);

/**
 * Get standard HTTP status text for a status code.
 */
function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return statusTexts[code] || "Unknown";
}
