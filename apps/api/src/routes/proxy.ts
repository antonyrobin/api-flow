import { Hono } from "hono";
import { validateJson } from "../lib/validate";
import { createDb, requestHistory } from "@api-flow/db";
import { executeRequestSchema } from "@api-flow/shared/validators";
import { nanoid, nowISO, getStatusText } from "@api-flow/shared";
import { isDevelopment, type Env } from "../types";
import { optionalAuth } from "../middleware/auth";
import { checkRateLimit, rateLimitedResponse } from "../middleware/rate-limit";
import { safeFetch, OutboundRequestError } from "../lib/http";

/** Maximum response body returned to the browser */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export const proxyRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: { id: string } | null };
}>();

// Proxy works for both authenticated and guest users.
// Guests can test any public API; only signed-in users get history stored.
proxyRoutes.use("*", optionalAuth);

// ============================================
// POST /proxy/execute — Execute an API request
// ============================================
proxyRoutes.post(
  "/execute",
  validateJson(executeRequestSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json") as any;

    if (!(await checkRateLimit(c, "proxy", user?.id ?? null))) {
      return rateLimitedResponse(c, !user);
    }

    const startTime = Date.now();
    let statusCode: number | undefined;
    let statusText: string | undefined;
    let responseHeaders: Record<string, string> = {};
    let responseBody = "";
    let responseSizeBytes = 0;
    let truncated = false;
    let errorMessage: string | undefined;

    // Timing breakdown (Workers fetch does not expose DNS/TCP/TLS phases)
    const timing = {
      dnsMs: 0,
      tcpMs: 0,
      tlsMs: 0,
      ttfbMs: 0,
      downloadMs: 0,
      totalMs: 0,
    };

    try {
      const result = await safeFetch(body.url, {
        method: body.method,
        headers: body.headers,
        body: body.body,
        timeoutMs: body.timeout,
        maxBytes: MAX_RESPONSE_BYTES,
        allowPrivateHosts: isDevelopment(c.env),
      });

      statusCode = result.status;
      statusText = result.statusText || getStatusText(result.status);
      responseHeaders = result.headers;
      responseBody = result.body;
      responseSizeBytes = result.sizeBytes;
      truncated = result.truncated;
      timing.ttfbMs = result.ttfbMs;
      timing.downloadMs = result.downloadMs;
    } catch (err) {
      errorMessage =
        err instanceof OutboundRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error occurred";
    }

    timing.totalMs = Date.now() - startTime;

    // Store history entry (only for authenticated users)
    if (user) {
      const db = createDb(c.env.DB);
      c.executionCtx.waitUntil(
        db
          .insert(requestHistory)
          .values({
            id: nanoid(),
            userId: user.id,
            method: body.method,
            // Strip query string — it frequently carries API keys
            url: body.url.split("?")[0]!.slice(0, 2048),
            statusCode: statusCode ?? null,
            responseSizeBytes,
            timingDnsMs: timing.dnsMs,
            timingTcpMs: timing.tcpMs,
            timingTlsMs: timing.tlsMs,
            timingTtfbMs: timing.ttfbMs,
            timingTotalMs: timing.totalMs,
            errorMessage: errorMessage ?? null,
            createdAt: nowISO(),
          })
          .then(() => undefined)
          .catch((dbErr) => console.error("[Proxy] Failed to store history:", dbErr))
      );
    }

    return c.json({
      data: {
        statusCode,
        statusText,
        headers: responseHeaders,
        body: responseBody,
        bodySize: responseSizeBytes,
        truncated,
        timing,
        error: errorMessage,
        timestamp: nowISO(),
      },
    });
  }
);
