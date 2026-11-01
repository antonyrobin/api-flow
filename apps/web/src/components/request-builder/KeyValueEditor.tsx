"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@api-flow/shared";

interface KeyValueEditorProps {
  title: string;
  addLabel: string;
  emptyLabel: string;
  keyPlaceholder: string;
  rows: KeyValuePair[];
  onChange: (rows: KeyValuePair[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

/**
 * Editable list of key/value rows (headers, query params).
 * Rows stack on phones and sit side by side from `sm` up.
 */
export function KeyValueEditor({
  title,
  addLabel,
  emptyLabel,
  keyPlaceholder,
  rows,
  onChange,
  onAdd,
  onRemove,
  onToggle,
}: KeyValueEditorProps) {
  const update = (id: string, field: "key" | "value", val: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        <button type="button" onClick={onAdd} className="btn-ghost flex items-center gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" aria-hidden />
          {addLabel}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 text-2xs uppercase tracking-wider text-gray-500 font-medium">
          <div className="w-5" />
          <div className="flex-1">Key</div>
          <div className="flex-1">Value</div>
          <div className="w-8" />
        </div>
      )}

      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            "group flex items-start sm:items-center gap-2 px-2 py-1.5 sm:py-1 rounded-lg",
            "hover:bg-surface-2/50 transition-colors duration-100"
          )}
        >
          {/* Toggle */}
          <label className="relative inline-flex items-center cursor-pointer mt-2 sm:mt-0">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={() => onToggle(row.id)}
              className="sr-only peer"
              aria-label={`${row.enabled ? "Disable" : "Enable"} ${row.key || "row"}`}
            />
            <span className="w-5 h-5 rounded border border-line/10 bg-surface-3 peer-checked:bg-brand-600 peer-checked:border-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50 flex items-center justify-center transition-all duration-200">
              {row.enabled && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          </label>

          <div className={cn("flex-1 min-w-0 flex flex-col sm:flex-row gap-1.5 sm:gap-2", !row.enabled && "opacity-40")}>
            <input
              type="text"
              value={row.key}
              onChange={(e) => update(row.id, "key", e.target.value)}
              placeholder={keyPlaceholder}
              aria-label="Key"
              spellCheck={false}
              autoCapitalize="off"
              className="flex-1 min-w-0 input-field text-sm py-1.5 font-mono"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => update(row.id, "value", e.target.value)}
              placeholder="Value"
              aria-label="Value"
              spellCheck={false}
              autoCapitalize="off"
              className="flex-1 min-w-0 input-field text-sm py-1.5 font-mono"
            />
          </div>

          {/* Delete — always visible on touch screens, on hover/focus with a mouse */}
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            aria-label={`Remove ${row.key || "row"}`}
            className="p-1.5 mt-1 sm:mt-0 text-gray-500 hover:text-red-400 rounded transition-opacity lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          {emptyLabel}{" "}
          <button type="button" onClick={onAdd} className="text-brand-400 hover:underline">
            Add one
          </button>
        </div>
      )}
    </div>
  );
}
