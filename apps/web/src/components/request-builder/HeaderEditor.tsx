"use client";

import React from "react";
import { useRequestStore } from "@/stores/request-store";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { KeyValuePair } from "@api-flow/shared";

export function HeaderEditor() {
  const { activeRequest, setHeaders, addHeader, removeHeader, toggleHeader } =
    useRequestStore();

  const updateHeader = (id: string, field: "key" | "value", val: string) => {
    setHeaders(
      activeRequest.headers.map((h) =>
        h.id === id ? { ...h, [field]: val } : h
      )
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Headers</h3>
        <button onClick={addHeader} className="btn-ghost flex items-center gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" />
          Add Header
        </button>
      </div>

      {/* Header Row Labels */}
      {activeRequest.headers.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-2xs uppercase tracking-wider text-gray-500 font-medium">
          <div className="w-6" />
          <div className="w-6" />
          <div className="flex-1">Key</div>
          <div className="flex-1">Value</div>
          <div className="w-8" />
        </div>
      )}

      {/* Header Rows */}
      {activeRequest.headers.map((header) => (
        <div
          key={header.id}
          className={cn(
            "kv-row flex items-center gap-2 px-2 rounded-lg",
            "hover:bg-surface-2/50 transition-colors duration-100",
            !header.enabled && "opacity-40"
          )}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-600 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Toggle */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={header.enabled}
              onChange={() => toggleHeader(header.id)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded border border-white/10 bg-surface-3 peer-checked:bg-brand-600 peer-checked:border-brand-500 flex items-center justify-center transition-all duration-200">
              {header.enabled && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          </label>

          {/* Key */}
          <input
            type="text"
            value={header.key}
            onChange={(e) => updateHeader(header.id, "key", e.target.value)}
            placeholder="Header name"
            className="flex-1 input-field text-sm py-1.5"
          />

          {/* Value */}
          <input
            type="text"
            value={header.value}
            onChange={(e) => updateHeader(header.id, "value", e.target.value)}
            placeholder="Value"
            className="flex-1 input-field text-sm py-1.5"
          />

          {/* Delete */}
          <button
            onClick={() => removeHeader(header.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {activeRequest.headers.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No headers configured.{" "}
          <button onClick={addHeader} className="text-brand-400 hover:underline">
            Add one
          </button>
        </div>
      )}
    </div>
  );
}
