"use client";

import React from "react";
import { useRequestStore } from "@/stores/request-store";
import { KeyValueEditor } from "./KeyValueEditor";

export function HeaderEditor() {
  const { activeRequest, setHeaders, addHeader, removeHeader, toggleHeader } = useRequestStore();

  return (
    <KeyValueEditor
      title="Headers"
      addLabel="Add Header"
      emptyLabel="No headers configured."
      keyPlaceholder="Header name"
      rows={activeRequest.headers}
      onChange={setHeaders}
      onAdd={addHeader}
      onRemove={removeHeader}
      onToggle={toggleHeader}
    />
  );
}
