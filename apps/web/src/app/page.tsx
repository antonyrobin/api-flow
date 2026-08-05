"use client";

import React from "react";
import { RequestBuilder } from "@/components/request-builder/RequestBuilder";
import { ResponseViewer } from "@/components/response-viewer/ResponseViewer";
import {
  Zap,
  Github,
  ChevronRight,
  Folder,
  Plus,
  User,
} from "lucide-react";

/**
 * Main workspace page — the API testing interface.
 * Works for both guests (no save) and authenticated users.
 */
export default function WorkspacePage() {
  return (
    <div className="flex h-screen bg-surface-0">
      {/* ===== Sidebar ===== */}
      <aside className="w-64 border-r border-white/5 flex flex-col bg-surface-1/50">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">API Flow</h1>
            <p className="text-2xs text-gray-500">v0.1.0</p>
          </div>
        </div>

        {/* Collections */}
        <div className="flex-1 overflow-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs uppercase tracking-wider text-gray-500 font-medium">
              Collections
            </span>
            <button className="p-1 rounded hover:bg-surface-3 text-gray-500 hover:text-gray-300 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Empty state for collections */}
          <div className="mt-4 px-3 py-6 text-center">
            <Folder className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-2">No collections yet</p>
            <p className="text-2xs text-gray-600">
              Sign in to save and organize your API requests into collections.
            </p>
          </div>
        </div>

        {/* User / Auth Section */}
        <div className="border-t border-white/5 p-3">
          <a
            href="/login"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-all duration-200 group"
          >
            <div className="w-7 h-7 rounded-full bg-surface-4 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 font-medium">Sign in</p>
              <p className="text-2xs text-gray-500 truncate">
                Save your work
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
          </a>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Request Builder (top half) */}
        <div className="flex-1 min-h-[300px] border-b border-white/5">
          <RequestBuilder />
        </div>

        {/* Resize Handle */}
        <div className="resize-handle group" />

        {/* Response Viewer (bottom half) */}
        <div className="flex-1 min-h-[200px]">
          <ResponseViewer />
        </div>
      </main>
    </div>
  );
}
