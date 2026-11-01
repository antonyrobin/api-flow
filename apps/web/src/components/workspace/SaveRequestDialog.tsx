"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useShallow } from "zustand/react/shallow";
import { useRequestStore } from "@/stores/request-store";
import { useCollections, useSaveRequest, useSavedRequests } from "@/hooks/use-saved-requests";
import { Dialog } from "@/components/ui/Dialog";
import { CollectionPicker, choiceToTarget, initialChoice, type CollectionChoice } from "./CollectionPicker";

export function SaveRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { activeRequest, savedRequestId, setName, setSavedRequestId } = useRequestStore(
    useShallow((s) => ({
      activeRequest: s.activeRequest,
      savedRequestId: s.savedRequestId,
      setName: s.setName,
      setSavedRequestId: s.setSavedRequestId,
    }))
  );
  const saveRequest = useSaveRequest();
  const { data: collections } = useCollections(!!session && open);
  const { data: savedRows } = useSavedRequests(!!session && open);

  const [name, setLocalName] = useState(activeRequest.name);
  const [includeCredentials, setIncludeCredentials] = useState(false);
  const [choice, setChoice] = useState<CollectionChoice>(() => initialChoice(collections));
  const [localError, setLocalError] = useState<string | null>(null);
  const hasCredentials = activeRequest.authType !== "none";

  useEffect(() => {
    if (open) {
      setLocalName(activeRequest.name);
      setLocalError(null);
      // Updating keeps the request in its current collection unless the user changes it
      const currentCollection = savedRows?.find((r) => r.id === savedRequestId)?.collectionId;
      setChoice(initialChoice(collections, currentCollection));
      saveRequest.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!session) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Sign in or sign up to save"
        description="You can test any API without an account. Saving requests and monitoring endpoints requires signing in."
        footer={
          <>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-secondary text-sm text-center">
              Sign in
            </Link>
            <Link href={`/register?next=${encodeURIComponent(pathname)}`} className="btn-primary text-sm text-center">
              Create free account
            </Link>
          </>
        }
      >
        <p className="text-sm text-gray-400">
          Your open tabs are kept in this browser while you sign in or sign up — save them right after.
        </p>
      </Dialog>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const target = choiceToTarget(choice);
    if (typeof target === "string") {
      setLocalError(target);
      return;
    }
    setLocalError(null);
    const trimmed = name.trim() || "Untitled Request";
    setName(trimmed);
    saveRequest.mutate(
      {
        id: savedRequestId,
        request: { ...activeRequest, name: trimmed },
        includeCredentials,
        target,
      },
      {
        onSuccess: (id) => {
          setSavedRequestId(id);
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={savedRequestId ? "Update saved request" : "Save request"}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="save-request-form"
            disabled={saveRequest.isPending}
            className="btn-primary text-sm disabled:opacity-60"
          >
            {saveRequest.isPending ? "Saving..." : savedRequestId ? "Update" : "Save"}
          </button>
        </>
      }
    >
      <form id="save-request-form" onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="request-name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Name
          </label>
          <input
            id="request-name"
            value={name}
            onChange={(e) => setLocalName(e.target.value)}
            maxLength={200}
            placeholder="e.g. List users"
            className="w-full input-field"
          />
        </div>

        <CollectionPicker id="request-collection" collections={collections} choice={choice} onChange={setChoice} />

        {hasCredentials && (
          <label className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCredentials}
              onChange={(e) => setIncludeCredentials(e.target.checked)}
              className="mt-0.5 accent-brand-500"
            />
            <span className="text-sm">
              <span className="text-gray-200 font-medium">Save auth credentials</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Off by default — tokens and passwords are not stored unless you opt in.
              </span>
            </span>
          </label>
        )}

        {(localError || saveRequest.error) && (
          <p role="alert" className="text-sm text-red-400">
            {localError || (saveRequest.error as Error).message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
