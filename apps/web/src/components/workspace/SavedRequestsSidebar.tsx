"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  DatabaseBackup,
  FilePlus2,
  Folder,
  FolderOpen,
  Library,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useRequestStore } from "@/stores/request-store";
import {
  rowToApiRequest,
  useCollections,
  useDeleteCollection,
  useDeleteRequest,
  useSavedRequests,
  type CollectionRow,
  type SavedRequestRow,
} from "@/hooks/use-saved-requests";
import { MethodBadge } from "@/components/ui/MethodBadge";

export function SavedRequestsSidebar({ onOpenBackup }: { onOpenBackup: () => void }) {
  const { data: session, isPending } = useSession();
  const isSignedIn = !!session;
  const { data: requests, isLoading, error } = useSavedRequests(isSignedIn);
  const { data: collections } = useCollections(isSignedIn);
  const deleteCollection = useDeleteCollection();
  const { newTab } = useRequestStore();
  const [filter, setFilter] = useState("");

  const q = filter.trim().toLowerCase();
  const filtered = (requests ?? []).filter(
    (r) => !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
  );
  const loose = filtered.filter((r) => !r.collectionId || !collections?.some((c) => c.id === r.collectionId));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-3 border-b border-line/5 flex gap-2">
        <button
          type="button"
          onClick={() => newTab()}
          className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
          title="New tab (Alt+T)"
        >
          <FilePlus2 className="w-4 h-4" aria-hidden />
          New request
        </button>
        <button
          type="button"
          onClick={onOpenBackup}
          className="btn-secondary px-3"
          aria-label="Import collection or backup"
          title="Import (Postman, API Flow backup)"
        >
          <Upload className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xs uppercase tracking-wider text-gray-500 font-medium">
            Saved requests
          </h2>
          {isSignedIn && requests && (
            <span className="text-2xs text-gray-600">{requests.length}</span>
          )}
        </div>

        {isPending ? null : !isSignedIn ? (
          <div className="mt-4 px-3 py-6 text-center">
            <Folder className="w-8 h-8 text-gray-600 mx-auto mb-2" aria-hidden />
            <p className="text-xs text-gray-400 mb-1">Testing is free — no account needed.</p>
            <p className="text-2xs text-gray-500 mb-4">
              Your open tabs stay in this browser. Create a free account to save requests, back up
              collections and monitor endpoints.
            </p>
            <Link href="/register" className="btn-primary text-xs inline-block">
              Create free account
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" aria-label="Loading" />
          </div>
        ) : error ? (
          <p className="text-xs text-red-400 px-2 py-4">{(error as Error).message}</p>
        ) : requests && requests.length === 0 && !collections?.length ? (
          <div className="text-xs text-gray-500 px-2 py-6 text-center space-y-3">
            <p>
              Nothing saved yet. Build a request and press <strong>Save</strong>.
            </p>
            <button type="button" onClick={onOpenBackup} className="text-brand-400 hover:text-brand-300 font-medium">
              …or import a Postman collection
            </button>
          </div>
        ) : (
          <>
            {requests && requests.length > 5 && (
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" aria-hidden />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter requests"
                  aria-label="Filter saved requests"
                  className="w-full input-field text-xs py-1.5 pl-8"
                />
              </div>
            )}

            {collections?.map((col) => {
              const items = filtered.filter((r) => r.collectionId === col.id);
              if (q && items.length === 0) return null;
              return (
                <CollectionGroup
                  key={col.id}
                  collection={col}
                  requests={items}
                  forceOpen={!!q}
                  onDelete={() => {
                    if (window.confirm(`Delete collection "${col.name}" and its ${items.length} request(s)?`)) {
                      deleteCollection.mutate(col.id);
                    }
                  }}
                />
              );
            })}

            {loose.length > 0 && (
              <ul className={cn("space-y-0.5", collections?.length ? "mt-2 pt-2 border-t border-line/5" : "")}>
                {loose.map((row) => (
                  <RequestItem key={row.id} row={row} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {isSignedIn && (
        <div className="border-t border-line/5 p-3 space-y-0.5">
          <button type="button" onClick={onOpenBackup} className="w-full sidebar-item">
            <DatabaseBackup className="w-4 h-4 text-brand-400" aria-hidden />
            Backup &amp; import
          </button>
          <Link href="/monitors" className="sidebar-item">
            <Activity className="w-4 h-4 text-brand-400" aria-hidden />
            Endpoint monitors
          </Link>
        </div>
      )}
    </div>
  );
}

function CollectionGroup({
  collection,
  requests,
  forceOpen,
  onDelete,
}: {
  collection: CollectionRow;
  requests: SavedRequestRow[];
  forceOpen: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open || forceOpen;

  // Folder path label (e.g. "Users / Admin") for each request
  const folderPath = useMemo(() => {
    const byId = new Map(collection.folders.map((f) => [f.id, f]));
    const path = (id: string | null): string => {
      const parts: string[] = [];
      let current = id ? byId.get(id) : undefined;
      for (let guard = 0; current && guard < 20; guard++) {
        parts.unshift(current.name);
        current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
      }
      return parts.join(" / ");
    };
    return path;
  }, [collection.folders]);

  const sorted = [...requests].sort((a, b) => folderPath(a.folderId).localeCompare(folderPath(b.folderId)));

  return (
    <div className="mb-1">
      <div className="group relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={expanded}
          className="w-full sidebar-item pr-9 text-left"
        >
          <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 transition-transform", expanded && "rotate-90")} aria-hidden />
          {expanded ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-brand-400" aria-hidden />
          ) : (
            <Library className="w-4 h-4 shrink-0 text-brand-400" aria-hidden />
          )}
          <span className="truncate text-gray-200 text-xs font-medium flex-1">{collection.name}</span>
          <span className="text-2xs text-gray-600">{requests.length}</span>
        </button>
        <button
          type="button"
          aria-label={`Delete collection ${collection.name}`}
          onClick={onDelete}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-surface-4 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <ul className="ml-3 pl-2 border-l border-line/5 space-y-0.5 mt-0.5">
          {sorted.length === 0 && <li className="text-2xs text-gray-600 px-3 py-1.5">Empty collection</li>}
          {sorted.map((row) => (
            <RequestItem key={row.id} row={row} folder={folderPath(row.folderId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestItem({ row, folder }: { row: SavedRequestRow; folder?: string }) {
  const { savedRequestId, openSavedRequest, detachSavedRequest } = useRequestStore();
  const deleteRequest = useDeleteRequest();

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => openSavedRequest(rowToApiRequest(row), row.id)}
        className={cn("w-full sidebar-item pr-9 text-left", savedRequestId === row.id && "sidebar-item-active")}
      >
        <MethodBadge method={row.method} size="sm" className="shrink-0 w-14 text-center" />
        <span className="min-w-0">
          <span className="block truncate text-gray-200 text-xs">{row.name}</span>
          <span className="block truncate text-2xs text-gray-500 font-mono">
            {folder ? <span className="font-sans text-gray-600">{folder} · </span> : null}
            {row.url}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`Delete ${row.name}`}
        onClick={() => {
          if (window.confirm(`Delete "${row.name}"?`)) {
            deleteRequest.mutate(row.id, { onSuccess: () => detachSavedRequest(row.id) });
          }
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-surface-4 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
