"use client";

import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useRequestStore } from "@/stores/request-store";
import { cn } from "@/lib/utils";
import { BODY_TYPES, METHODS_WITH_BODY } from "@api-flow/shared/constants";
import type { BodyType } from "@api-flow/shared/constants";

const BODY_TYPE_LABELS: Record<string, string> = {
  none: "None",
  json: "JSON",
  "form-data": "Form Data",
  "x-www-form-urlencoded": "URL Encoded",
  xml: "XML",
  text: "Plain Text",
  binary: "Binary",
  graphql: "GraphQL",
};

export function BodyEditor() {
  const { activeRequest, setBody, setBodyType } = useRequestStore(
    useShallow((s) => ({ activeRequest: s.activeRequest, setBody: s.setBody, setBodyType: s.setBodyType }))
  );

  const showBodyWarning =
    !METHODS_WITH_BODY.includes(activeRequest.method) &&
    activeRequest.bodyType !== "none";

  return (
    <div className="space-y-4">
      {/* Body Type Selector */}
      <div className="flex items-center gap-1 flex-wrap">
        {BODY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setBodyType(type as BodyType)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
              activeRequest.bodyType === type
                ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-surface-3 border border-transparent"
            )}
          >
            {BODY_TYPE_LABELS[type] || type}
          </button>
        ))}
      </div>

      {/* Warning for non-body methods */}
      {showBodyWarning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <span>⚠️</span>
          <span>
            {activeRequest.method} requests typically don&apos;t include a body.
          </span>
        </div>
      )}

      {/* Body Editor */}
      {activeRequest.bodyType === "none" ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          This request does not have a body.
        </div>
      ) : activeRequest.bodyType === "form-data" ||
        activeRequest.bodyType === "x-www-form-urlencoded" ? (
        <FormDataEditor />
      ) : (
        <div className="relative">
          <textarea
            value={activeRequest.body || ""}
            onChange={(e) => setBody(e.target.value)}
            placeholder={getPlaceholder(activeRequest.bodyType)}
            rows={12}
            className={cn(
              "w-full px-4 py-3 rounded-lg font-mono text-sm leading-relaxed",
              "bg-surface-2 border border-line/10",
              "text-gray-200 placeholder-gray-600",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/40",
              "resize-y transition-all duration-200"
            )}
            spellCheck={false}
          />
          {/* Line numbers overlay hint */}
          <div className="absolute top-3 right-3 text-2xs text-gray-600">
            {activeRequest.bodyType.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}

function FormDataEditor() {
  return (
    <div className="text-center py-8 text-gray-500 text-sm">
      <p>Form data editor coming soon.</p>
      <p className="text-gray-600 mt-1">
        For now, switch to JSON and use the text editor.
      </p>
    </div>
  );
}

function getPlaceholder(bodyType: string): string {
  switch (bodyType) {
    case "json":
      return '{\n  "key": "value"\n}';
    case "xml":
      return '<?xml version="1.0"?>\n<root>\n  <element>value</element>\n</root>';
    case "graphql":
      return "query {\n  users {\n    id\n    name\n    email\n  }\n}";
    case "text":
      return "Enter plain text...";
    default:
      return "Enter body content...";
  }
}
