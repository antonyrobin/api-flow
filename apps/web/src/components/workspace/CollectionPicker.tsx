"use client";

import React, { useEffect, useRef } from "react";
import type { CollectionRow, CollectionTarget } from "@/hooks/use-saved-requests";

export const NEW_COLLECTION = "__new__";

export interface CollectionChoice {
  /** A collection id, or NEW_COLLECTION */
  value: string;
  newName: string;
}

/** Resolve the picker state to a save target, or an error message */
export function choiceToTarget(choice: CollectionChoice): CollectionTarget | string {
  if (choice.value !== NEW_COLLECTION) return { collectionId: choice.value };
  const name = choice.newName.trim();
  return name ? { newCollectionName: name } : "Enter a name for the new collection.";
}

/** Initial choice: the given collection if it still exists, else the first one, else "new" */
export function initialChoice(collections: CollectionRow[] | undefined, preferredId?: string | null): CollectionChoice {
  const list = collections ?? [];
  const value =
    (preferredId && list.some((c) => c.id === preferredId) ? preferredId : list[0]?.id) ?? NEW_COLLECTION;
  return { value, newName: "" };
}

/**
 * Select an existing collection or create a new one inline.
 */
export function CollectionPicker({
  id,
  collections,
  choice,
  onChange,
}: {
  id: string;
  collections: CollectionRow[] | undefined;
  choice: CollectionChoice;
  onChange: (choice: CollectionChoice) => void;
}) {
  const isNew = choice.value === NEW_COLLECTION;
  const newNameRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(!!collections);

  // Collections may finish loading after the dialog opened: pick the first one then
  useEffect(() => {
    if (loadedRef.current || !collections) return;
    loadedRef.current = true;
    if (isNew && !choice.newName && collections.length) {
      onChange({ value: collections[0]!.id, newName: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
        Collection
      </label>
      <select
        id={id}
        value={choice.value}
        onChange={(e) => {
          onChange({ ...choice, value: e.target.value });
          if (e.target.value === NEW_COLLECTION) requestAnimationFrame(() => newNameRef.current?.focus());
        }}
        className="w-full input-field"
      >
        {collections?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_COLLECTION}>+ Create new collection…</option>
      </select>
      {isNew && (
        <input
          ref={newNameRef}
          value={choice.newName}
          onChange={(e) => onChange({ ...choice, newName: e.target.value })}
          maxLength={200}
          placeholder="New collection name"
          aria-label="New collection name"
          className="w-full input-field mt-2"
        />
      )}
    </div>
  );
}
