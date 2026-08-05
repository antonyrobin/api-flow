"use client";

import React from "react";
import { useRequestStore } from "@/stores/request-store";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export function QueryParams() {
  const {
    activeRequest,
    setQueryParams,
    addQueryParam,
    removeQueryParam,
    toggleQueryParam,
  } = useRequestStore();

  const updateParam = (id: string, field: "key" | "value", val: string) => {
    setQueryParams(
      activeRequest.queryParams.map((p) =>
        p.id === id ? { ...p, [field]: val } : p
      )
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Query Parameters</h3>
        <button
          onClick={addQueryParam}
          className="btn-ghost flex items-center gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Param
        </button>
      </div>

      {activeRequest.queryParams.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-2xs uppercase tracking-wider text-gray-500 font-medium">
          <div className="w-6" />
          <div className="flex-1">Key</div>
          <div className="flex-1">Value</div>
          <div className="w-8" />
        </div>
      )}

      {activeRequest.queryParams.map((param) => (
        <div
          key={param.id}
          className={cn(
            "kv-row flex items-center gap-2 px-2 rounded-lg",
            "hover:bg-surface-2/50 transition-colors",
            !param.enabled && "opacity-40"
          )}
        >
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={param.enabled}
              onChange={() => toggleQueryParam(param.id)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded border border-white/10 bg-surface-3 peer-checked:bg-brand-600 peer-checked:border-brand-500 flex items-center justify-center transition-all duration-200">
              {param.enabled && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </label>

          <input
            type="text"
            value={param.key}
            onChange={(e) => updateParam(param.id, "key", e.target.value)}
            placeholder="Parameter name"
            className="flex-1 input-field text-sm py-1.5"
          />

          <input
            type="text"
            value={param.value}
            onChange={(e) => updateParam(param.id, "value", e.target.value)}
            placeholder="Value"
            className="flex-1 input-field text-sm py-1.5"
          />

          <button
            onClick={() => removeQueryParam(param.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {activeRequest.queryParams.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No query parameters.{" "}
          <button onClick={addQueryParam} className="text-brand-400 hover:underline">
            Add one
          </button>
        </div>
      )}
    </div>
  );
}
