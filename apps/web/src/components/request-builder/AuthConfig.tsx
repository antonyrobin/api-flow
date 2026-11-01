"use client";

import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useRequestStore } from "@/stores/request-store";
import { cn } from "@/lib/utils";
import { AUTH_TYPES } from "@api-flow/shared/constants";
import type { AuthType } from "@api-flow/shared/constants";
import { Shield, Key, User, Lock } from "lucide-react";

const AUTH_TYPE_CONFIG = {
  none: { label: "No Auth", icon: Shield, description: "No authentication" },
  bearer: { label: "Bearer Token", icon: Key, description: "Token-based authentication" },
  basic: { label: "Basic Auth", icon: User, description: "Username and password" },
  "api-key": { label: "API Key", icon: Lock, description: "API key in header or query" },
  oauth2: { label: "OAuth 2.0", icon: Shield, description: "OAuth 2.0 flow (coming soon)" },
};

export function AuthConfig() {
  const { activeRequest, setAuthType, setAuthConfig } = useRequestStore(
    useShallow((s) => ({ activeRequest: s.activeRequest, setAuthType: s.setAuthType, setAuthConfig: s.setAuthConfig }))
  );

  return (
    <div className="space-y-6">
      {/* Auth Type Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {AUTH_TYPES.map((type) => {
          const config = AUTH_TYPE_CONFIG[type as AuthType];
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setAuthType(type as AuthType)}
              className={cn(
                "flex items-center gap-2 px-3 py-3 rounded-lg text-left transition-all duration-200",
                "border",
                activeRequest.authType === type
                  ? "bg-brand-600/10 border-brand-500/30 text-brand-400"
                  : "bg-surface-2 border-line/5 text-gray-400 hover:bg-surface-3 hover:text-gray-200"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div>
                <div className="text-sm font-medium">{config.label}</div>
                <div className="text-2xs opacity-60">{config.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Auth Config Fields */}
      <div className="glass-panel p-4">
        {activeRequest.authType === "none" && (
          <p className="text-gray-500 text-sm text-center py-4">
            No authentication will be applied to this request.
          </p>
        )}

        {activeRequest.authType === "bearer" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Token
            </label>
            <input
              type="text"
              value={activeRequest.authConfig.token || ""}
              onChange={(e) =>
                setAuthConfig({ ...activeRequest.authConfig, token: e.target.value })
              }
              placeholder="Enter bearer token"
              className="w-full input-field font-mono"
            />
            <p className="text-2xs text-gray-500">
              The token will be sent as: <code className="text-brand-400">Authorization: Bearer &lt;token&gt;</code>
            </p>
          </div>
        )}

        {activeRequest.authType === "basic" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={activeRequest.authConfig.username || ""}
                onChange={(e) =>
                  setAuthConfig({ ...activeRequest.authConfig, username: e.target.value })
                }
                placeholder="Username"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={activeRequest.authConfig.password || ""}
                onChange={(e) =>
                  setAuthConfig({ ...activeRequest.authConfig, password: e.target.value })
                }
                placeholder="Password"
                className="w-full input-field"
              />
            </div>
          </div>
        )}

        {activeRequest.authType === "api-key" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Key Name
              </label>
              <input
                type="text"
                value={activeRequest.authConfig.apiKeyName || ""}
                onChange={(e) =>
                  setAuthConfig({ ...activeRequest.authConfig, apiKeyName: e.target.value })
                }
                placeholder="e.g., X-API-Key"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Key Value
              </label>
              <input
                type="password"
                value={activeRequest.authConfig.apiKeyValue || ""}
                onChange={(e) =>
                  setAuthConfig({ ...activeRequest.authConfig, apiKeyValue: e.target.value })
                }
                placeholder="API key value"
                className="w-full input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Add to
              </label>
              <div className="flex gap-2">
                {(["header", "query"] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() =>
                      setAuthConfig({ ...activeRequest.authConfig, apiKeyLocation: loc })
                    }
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-lg border transition-all",
                      activeRequest.authConfig.apiKeyLocation === loc ||
                        (!activeRequest.authConfig.apiKeyLocation && loc === "header")
                        ? "bg-brand-600/20 border-brand-500/30 text-brand-400"
                        : "border-line/10 text-gray-400 hover:bg-surface-3"
                    )}
                  >
                    {loc === "header" ? "Header" : "Query Param"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeRequest.authType === "oauth2" && (
          <p className="text-gray-500 text-sm text-center py-4">
            OAuth 2.0 configuration coming soon.
          </p>
        )}
      </div>
    </div>
  );
}
