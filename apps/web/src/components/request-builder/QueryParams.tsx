"use client";

import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useRequestStore } from "@/stores/request-store";
import { KeyValueEditor } from "./KeyValueEditor";

export function QueryParams() {
  const { activeRequest, setQueryParams, addQueryParam, removeQueryParam, toggleQueryParam } = useRequestStore(
    useShallow((s) => ({ activeRequest: s.activeRequest, setQueryParams: s.setQueryParams, addQueryParam: s.addQueryParam, removeQueryParam: s.removeQueryParam, toggleQueryParam: s.toggleQueryParam }))
  );

  return (
    <KeyValueEditor
      title="Query Parameters"
      addLabel="Add Param"
      emptyLabel="No query parameters."
      keyPlaceholder="Parameter name"
      rows={activeRequest.queryParams}
      onChange={setQueryParams}
      onAdd={addQueryParam}
      onRemove={removeQueryParam}
      onToggle={toggleQueryParam}
    />
  );
}
