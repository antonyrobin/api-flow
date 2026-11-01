"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BodyFormat } from "./body-format";

/** Above this size, code is shown without colouring to keep typing/scrolling smooth */
const HIGHLIGHT_LIMIT = 300_000;

const JSON_TOKENS =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

const MARKUP_TOKENS =
  /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?>)|(<[!?][^>]*>)/g;

const ATTR_TOKENS = /([^\s=/>]+)(?:(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+))?/g;

function highlightJson(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  JSON_TOKENS.lastIndex = 0;
  while ((m = JSON_TOKENS.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const [whole, str, colon, num, lit, punct] = m;
    if (str !== undefined) {
      nodes.push(
        <span key={m.index} className={colon ? "tok-key" : "tok-string"}>
          {str}
        </span>
      );
      if (colon) nodes.push(<span key={`${m.index}c`} className="tok-punct">{colon}</span>);
    } else if (num !== undefined) {
      nodes.push(<span key={m.index} className="tok-number">{num}</span>);
    } else if (lit !== undefined) {
      nodes.push(<span key={m.index} className="tok-bool">{lit}</span>);
    } else if (punct !== undefined) {
      nodes.push(<span key={m.index} className="tok-punct">{punct}</span>);
    } else {
      nodes.push(whole);
    }
    last = m.index + whole.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function highlightAttrs(attrs: string, key: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  ATTR_TOKENS.lastIndex = 0;
  while ((m = ATTR_TOKENS.exec(attrs))) {
    if (m.index > last) nodes.push(attrs.slice(last, m.index));
    nodes.push(<span key={`${key}a${m.index}`} className="tok-attr">{m[1]}</span>);
    if (m[2]) nodes.push(<span key={`${key}e${m.index}`} className="tok-punct">{m[2]}</span>);
    if (m[3]) nodes.push(<span key={`${key}v${m.index}`} className="tok-string">{m[3]}</span>);
    last = m.index + m[0].length;
  }
  if (last < attrs.length) nodes.push(attrs.slice(last));
  return nodes;
}

function highlightMarkup(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARKUP_TOKENS.lastIndex = 0;
  while ((m = MARKUP_TOKENS.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const [whole, comment, open, name, attrs, close, decl] = m;
    if (comment || decl) {
      nodes.push(<span key={m.index} className="tok-comment">{comment || decl}</span>);
    } else {
      nodes.push(
        <span key={m.index}>
          <span className="tok-punct">{open}</span>
          <span className="tok-tag">{name}</span>
          {attrs ? highlightAttrs(attrs, m.index) : null}
          <span className="tok-punct">{close}</span>
        </span>
      );
    }
    last = m.index + whole.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function CodeBlock({ text, format, wrap }: { text: string; format: BodyFormat; wrap: boolean }) {
  const content = useMemo(() => {
    if (text.length > HIGHLIGHT_LIMIT) return text;
    if (format === "json") return highlightJson(text);
    if (format === "xml" || format === "html") return highlightMarkup(text);
    return text;
  }, [text, format]);

  const lineCount = useMemo(() => (text.length > HIGHLIGHT_LIMIT ? 0 : text.split("\n").length), [text]);

  return (
    <div className="flex min-w-0 text-xs sm:text-[13px] font-mono leading-relaxed">
      {lineCount > 1 && !wrap && (
        <div aria-hidden className="select-none text-right pr-3 pl-3 py-3 sm:py-4 text-gray-600 border-r border-line/5 shrink-0">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <pre
        className={cn(
          "flex-1 min-w-0 p-3 sm:p-4 text-gray-300",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
        )}
      >
        {content}
      </pre>
    </div>
  );
}

// ============================================
// JSON tree (Preview)
// ============================================

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="p-3 sm:p-4 font-mono text-xs sm:text-[13px] leading-relaxed">
      <JsonNode value={value} depth={0} last />
    </div>
  );
}

function JsonNode({ name, value, depth, last }: { name?: string; value: unknown; depth: number; last: boolean }) {
  const [open, setOpen] = useState(depth < 2);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";
  const comma = last ? "" : ",";
  const label =
    name !== undefined ? (
      <>
        <span className="tok-key">&quot;{name}&quot;</span>
        <span className="tok-punct">: </span>
      </>
    ) : null;

  if (!isObject) {
    const cls =
      typeof value === "string" ? "tok-string" : typeof value === "number" ? "tok-number" : "tok-bool";
    return (
      <div className="pl-4 break-all">
        {label}
        <span className={cls}>{JSON.stringify(value)}</span>
        <span className="tok-punct">{comma}</span>
      </div>
    );
  }

  const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value as object);
  const [openBrace, closeBrace] = isArray ? ["[", "]"] : ["{", "}"];

  if (entries.length === 0) {
    return (
      <div className="pl-4">
        {label}
        <span className="tok-punct">
          {openBrace}
          {closeBrace}
          {comma}
        </span>
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Collapse" : "Expand"}
        className="absolute left-0 top-[3px] text-gray-500 hover:text-gray-200"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {label}
      <span className="tok-punct">{openBrace}</span>
      {open ? (
        <>
          <div className="border-l border-line/5 ml-0.5">
            {entries.map(([k, v], i) => (
              <JsonNode
                key={k}
                name={isArray ? undefined : k}
                value={v}
                depth={depth + 1}
                last={i === entries.length - 1}
              />
            ))}
          </div>
          <span className="tok-punct">
            {closeBrace}
            {comma}
          </span>
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-gray-500 hover:text-gray-300">
          {" "}
          {isArray ? `${entries.length} items` : `${entries.length} keys`}{" "}
          <span className="tok-punct">
            {closeBrace}
            {comma}
          </span>
        </button>
      )}
    </div>
  );
}

// ============================================
// XML tree (Preview)
// ============================================

export function XmlTree({ source }: { source: string }) {
  const doc = useMemo(() => {
    try {
      const parsed = new DOMParser().parseFromString(source, "application/xml");
      return parsed.getElementsByTagName("parsererror").length ? null : parsed;
    } catch {
      return null;
    }
  }, [source]);

  if (!doc?.documentElement) {
    return <p className="p-4 text-sm text-amber-300">This body isn&apos;t well-formed XML — showing it as text is the best option.</p>;
  }
  return (
    <div className="p-3 sm:p-4 font-mono text-xs sm:text-[13px] leading-relaxed">
      <XmlNode node={doc.documentElement} depth={0} />
    </div>
  );
}

function XmlNode({ node, depth }: { node: Element; depth: number }) {
  const [open, setOpen] = useState(depth < 3);
  const children = Array.from(node.childNodes).filter(
    (c) => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) || c.nodeType === Node.CDATA_SECTION_NODE
  );
  const attrs = Array.from(node.attributes);
  const tagOpen = (
    <>
      <span className="tok-punct">&lt;</span>
      <span className="tok-tag">{node.tagName}</span>
      {attrs.map((a) => (
        <span key={a.name}>
          {" "}
          <span className="tok-attr">{a.name}</span>
          <span className="tok-punct">=</span>
          <span className="tok-string">&quot;{a.value}&quot;</span>
        </span>
      ))}
    </>
  );
  const tagClose = (
    <>
      <span className="tok-punct">&lt;/</span>
      <span className="tok-tag">{node.tagName}</span>
      <span className="tok-punct">&gt;</span>
    </>
  );

  if (children.length === 0) {
    return (
      <div className="pl-4">
        {tagOpen}
        <span className="tok-punct"> /&gt;</span>
      </div>
    );
  }
  if (children.length === 1 && children[0].nodeType !== Node.ELEMENT_NODE) {
    return (
      <div className="pl-4 break-all">
        {tagOpen}
        <span className="tok-punct">&gt;</span>
        <span className="text-gray-200">{children[0].textContent?.trim()}</span>
        {tagClose}
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Collapse" : "Expand"}
        className="absolute left-0 top-[3px] text-gray-500 hover:text-gray-200"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {tagOpen}
      <span className="tok-punct">&gt;</span>
      {open ? (
        <>
          <div className="border-l border-line/5 ml-0.5">
            {children.map((child, i) =>
              child.nodeType === Node.ELEMENT_NODE ? (
                <XmlNode key={i} node={child as Element} depth={depth + 1} />
              ) : (
                <div key={i} className="pl-4 text-gray-200 break-all">
                  {child.textContent?.trim()}
                </div>
              )
            )}
          </div>
          {tagClose}
        </>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-gray-500 hover:text-gray-300">
          {" "}
          …{" "}
          {tagClose}
        </button>
      )}
    </div>
  );
}
