/**
 * Response body format detection and pretty-printing helpers.
 */

export type BodyFormat = "json" | "xml" | "html" | "javascript" | "css" | "text";

export const BODY_FORMAT_LABELS: Record<BodyFormat, string> = {
  json: "JSON",
  xml: "XML",
  html: "HTML",
  javascript: "JavaScript",
  css: "CSS",
  text: "Plain Text",
};

export function getContentType(headers: Record<string, string>): string {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
  return key ? headers[key].toLowerCase() : "";
}

/** Pick a format from the Content-Type header, falling back to sniffing the body */
export function detectFormat(body: string, contentType: string): BodyFormat {
  if (/[/+]json\b|\bjson\b/.test(contentType)) return "json";
  if (/html/.test(contentType)) return "html";
  if (/[/+]xml\b/.test(contentType)) return "xml";
  if (/javascript|ecmascript/.test(contentType)) return "javascript";
  if (/text\/css/.test(contentType)) return "css";

  const start = body.trimStart().slice(0, 200).toLowerCase();
  if (start.startsWith("{") || start.startsWith("[")) {
    try {
      JSON.parse(body);
      return "json";
    } catch {
      /* not JSON */
    }
  }
  if (start.startsWith("<!doctype html") || start.startsWith("<html")) return "html";
  if (start.startsWith("<?xml") || /^<[a-z_][\w:.-]*[\s>]/i.test(start)) return "xml";
  return "text";
}

export function prettyJson(body: string): { text: string; ok: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(body), null, 2), ok: true };
  } catch {
    return { text: body, ok: false };
  }
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);

/**
 * Re-indent XML / HTML. Keeps text, comments, CDATA and <script>/<style>
 * contents intact; only whitespace between tags changes.
 */
export function prettyMarkup(source: string, html: boolean): string {
  const tokens = source.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g);
  if (!tokens) return source;

  const out: string[] = [];
  let depth = 0;
  let raw: string | null = null; // inside <script>/<style>
  const pad = () => "  ".repeat(Math.max(0, depth));

  for (const token of tokens) {
    if (raw) {
      if (new RegExp(`^</${raw}\\s*>$`, "i").test(token)) {
        raw = null;
        depth--;
        out.push(pad() + token);
      } else if (token.trim()) {
        out.push(token.replace(/^\n+|\s+$/g, ""));
      }
      continue;
    }

    if (!token.startsWith("<")) {
      const text = token.trim();
      if (text) out.push(pad() + text);
      continue;
    }

    if (token.startsWith("</")) {
      depth--;
      // Collapse <tag>text</tag> onto one line
      const prev = out[out.length - 1];
      const prevOpen = out[out.length - 2];
      if (prev && prevOpen && !prev.trimStart().startsWith("<") && /^\s*<[^/!?][^>]*>$/.test(prevOpen) && !prevOpen.trim().endsWith("/>")) {
        out.splice(out.length - 2, 2, prevOpen + prev.trim() + token);
      } else {
        out.push(pad() + token);
      }
      continue;
    }

    out.push(pad() + token);
    const name = token.match(/^<([a-zA-Z][\w:.-]*)/)?.[1]?.toLowerCase();
    const selfClosing = token.endsWith("/>") || token.startsWith("<!") || token.startsWith("<?");
    if (!name || selfClosing || (html && VOID_ELEMENTS.has(name))) continue;
    depth++;
    if (html && (name === "script" || name === "style")) raw = name;
  }

  return out.join("\n");
}

export function prettyBody(body: string, format: BodyFormat): string {
  if (body.length > 2_000_000) return body; // keep the UI responsive on huge bodies
  switch (format) {
    case "json":
      return prettyJson(body).text;
    case "xml":
      return prettyMarkup(body, false);
    case "html":
      return prettyMarkup(body, true);
    default:
      return body;
  }
}

export function fileExtension(format: BodyFormat): string {
  return { json: "json", xml: "xml", html: "html", javascript: "js", css: "css", text: "txt" }[format];
}
