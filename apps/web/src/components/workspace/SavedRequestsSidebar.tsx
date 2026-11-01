"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  DatabaseBackup,
  FilePlus2,
  Folder,
  FolderInput,
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
  useMoveRequestToCollection,
  useSavedRequests,
  type CollectionRow,
  type SavedRequestRow,
} from "@/hooks/use-saved-requests";
import { MethodBadge } from "@/components/ui/MethodBadge";
import { Dialog } from "@/components/ui/Dialog";
import { useSidebarDrawer } from "@/components/layout/AppShell";
import { CollectionPicker, choiceToTarget, initialChoice, type CollectionChoice } from "./CollectionPicker";

export function SavedRequestsSidebar({ onOpenBackup: openBackup }: { onOpenBackup: () => void }) {
  const { data: session, isPending } = useSession();
  const isSignedIn = !!session;
  const { data: requests, isLoading, error } = useSavedRequests(isSignedIn);
  const { data: collections } = useCollections(isSignedIn);
  const deleteCollection = useDeleteCollection();
  // Select only the action so typing in the editor doesn't re-render the sidebar
  const newTab = useRequestStore((s) => s.newTab);
  const { closeDrawer } = useSidebarDrawer();
  const [filter, setFilter] = useState("");
  const [moving, setMoving] = useState<SavedRequestRow | null>(null);

  const onOpenBackup = () => {
    closeDrawer();
    openBackup();
  };

  const q = filter.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (requests ?? []).filter(
        (r) => !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
      ),
    [requests, q]
  );
  // Group once (O(n)) instead of filtering the whole list per collection
  const byCollection = useMemo(() => {
    const map = new Map<string | null, SavedRequestRow[]>();
    const known = new Set(collections?.map((c) => c.id));
    for (const r of filtered) {
      const key = r.collectionId && known.has(r.collectionId) ? r.collectionId : null;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [filtered, collections]);
  const loose = byCollection.get(null) ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-3 border-b border-line/5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            newTab();
            closeDrawer();
          }}
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
              const items = byCollection.get(col.id) ?? [];
              if (q && items.length === 0) return null;
              return (
                <CollectionGroup
                  key={col.id}
                  collection={col}
                  requests={items}
                  forceOpen={!!q}
                  onMove={setMoving}
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
                  <RequestItem key={row.id} row={row} onMove={() => setMoving(row)} />
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

      <AddToCollectionDialog row={moving} collections={collections} onClose={() => setMoving(null)} />
    </div>
  );
}

function CollectionGroup({
  collection,
  requests,
  forceOpen,
  onMove,
  onDelete,
}: {
  collection: CollectionRow;
  requests: SavedRequestRow[];
  forceOpen: boolean;
  onMove: (row: SavedRequestRow) => void;
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

  const sorted = useMemo(
    () => [...requests].sort((a, b) => folderPath(a.folderId).localeCompare(folderPath(b.folderId))),
    [requests, folderPath]
  );

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
            <RequestItem key={row.id} row={row} folder={folderPath(row.folderId)} onMove={() => onMove(row)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestItem({ row, folder, onMove }: { row: SavedRequestRow; folder?: string; onMove: () => void }) {
  // Narrow selectors: an item only re-renders when its own active state changes
  const isActive = useRequestStore((s) => s.savedRequestId === row.id);
  const openSavedRequest = useRequestStore((s) => s.openSavedRequest);
  const detachSavedRequest = useRequestStore((s) => s.detachSavedRequest);
  const { closeDrawer } = useSidebarDrawer();
  const deleteRequest = useDeleteRequest();

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => {
          openSavedRequest(rowToApiRequest(row), row.id);
          // On phones the sidebar is a drawer over the request — get it out of the way
          closeDrawer();
        }}
        className={cn("w-full sidebar-item pr-16 text-left", isActive && "sidebar-item-active")}
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
        aria-label={`${row.collectionId ? "Move" : "Add"} ${row.name} to a collection`}
        title={row.collectionId ? "Move to collection" : "Add to collection"}
        onClick={onMove}
        className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-500 hover:text-brand-300 hover:bg-surface-4 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <FolderInput className="w-3.5 h-3.5" />
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

function AddToCollectionDialog({
  row,
  collections,
  onClose,
}: {
  row: SavedRequestRow | null;
  collections: CollectionRow[] | undefined;
  onClose: () => void;
}) {
  const move = useMoveRequestToCollection();
  const [choice, setChoice] = useState<CollectionChoice>(() => initialChoice(collections));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    // Default to a collection other than the one it is already in
    const other = collections?.find((c) => c.id !== row.collectionId);
    setChoice(initialChoice(collections, other?.id));
    setLocalError(null);
    move.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!row) return;
    const target = choiceToTarget(choice);
    if (typeof target === "string") {
      setLocalError(target);
      return;
    }
    if ("collectionId" in target && target.collectionId === row.collectionId) {
      onClose();
      return;
    }
    move.mutate({ id: row.id, target }, { onSuccess: onClose });
  };

  const shownError = localError || (move.error as Error | null)?.message;

  return (
    <Dialog
      open={!!row}
      onClose={onClose}
      title={row?.collectionId ? "Move to collection" : "Add to collection"}
      description={row ? `"${row.name}"` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="add-to-collection-form"
            disabled={move.isPending}
            className="btn-primary text-sm disabled:opacity-60"
          >
            {move.isPending ? "Saving..." : row?.collectionId ? "Move" : "Add"}
          </button>
        </>
      }
    >
      <form id="add-to-collection-form" onSubmit={handleSubmit} className="space-y-4">
        <CollectionPicker id="move-collection" collections={collections} choice={choice} onChange={setChoice} />
        {shownError && (
          <p role="alert" className="text-sm text-red-400">
            {shownError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
