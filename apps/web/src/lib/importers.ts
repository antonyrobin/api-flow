import { nanoid } from "@api-flow/shared";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupCollection,
  type BackupEnvironment,
  type BackupFile,
  type BackupRequest,
} from "@api-flow/shared/validators";
import { HTTP_METHODS, type HttpMethod } from "@api-flow/shared/constants";
import type { KeyValuePair } from "@api-flow/shared";

/**
 * Convert supported import files into the API Flow backup format:
 * - API Flow backup (api-flow-backup v1)
 * - Postman Collection v2.0 / v2.1
 * - Postman Environment
 * - Postman data dump (collections + environments)
 */

export type ImportKind = "api-flow-backup" | "postman-collection" | "postman-environment" | "postman-dump";

export interface ParsedImport {
  kind: ImportKind;
  label: string;
  backup: BackupFile;
  warnings: string[];
}

export class ImportError extends Error {}

export function emptyBackup(): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    collections: [],
    requests: [],
    environments: [],
    monitors: [],
  };
}

/** Combine several parsed files into one import */
export function mergeBackups(files: BackupFile[]): BackupFile {
  const merged = emptyBackup();
  for (const file of files) {
    merged.collections.push(...file.collections);
    merged.requests.push(...file.requests);
    merged.environments.push(...file.environments);
    merged.monitors.push(...file.monitors);
  }
  return merged;
}

export function parseImportText(text: string, fileName = "pasted JSON"): ParsedImport {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new ImportError(`${fileName}: not valid JSON`);
  }
  if (!json || typeof json !== "object") throw new ImportError(`${fileName}: unsupported file`);
  const data = json as Record<string, any>;

  if (data.format === BACKUP_FORMAT) {
    if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
      throw new ImportError(`${fileName}: backup was made by a newer version of API Flow`);
    }
    return {
      kind: "api-flow-backup",
      label: `API Flow backup (${fileName})`,
      backup: { ...emptyBackup(), ...data, format: BACKUP_FORMAT, version: BACKUP_VERSION } as BackupFile,
      warnings: [],
    };
  }

  if (data.info && Array.isArray(data.item)) {
    const warnings: string[] = [];
    const backup = emptyBackup();
    convertPostmanCollection(data, backup, warnings);
    return { kind: "postman-collection", label: `Postman collection “${data.info.name ?? fileName}”`, backup, warnings };
  }

  if (Array.isArray(data.values) && (data._postman_variable_scope || data.name)) {
    const backup = emptyBackup();
    backup.environments.push(convertPostmanEnvironment(data));
    return { kind: "postman-environment", label: `Postman environment “${data.name ?? fileName}”`, backup, warnings: [] };
  }

  // Postman "Export data" dump
  if (Array.isArray(data.collections) || Array.isArray(data.environments)) {
    const warnings: string[] = [];
    const backup = emptyBackup();
    for (const col of data.collections ?? []) {
      if (col?.info && Array.isArray(col.item)) convertPostmanCollection(col, backup, warnings);
      else warnings.push(`Skipped a collection in an old Postman v1 format — re-export it as v2.1`);
    }
    for (const env of data.environments ?? []) {
      if (Array.isArray(env?.values)) backup.environments.push(convertPostmanEnvironment(env));
    }
    return { kind: "postman-dump", label: `Postman data export (${fileName})`, backup, warnings };
  }

  if (Array.isArray(data.requests) && Array.isArray(data.order)) {
    throw new ImportError(
      `${fileName}: Postman v1 collections aren't supported — in Postman use Export → Collection v2.1`
    );
  }

  throw new ImportError(`${fileName}: not an API Flow backup or Postman collection/environment`);
}

// ============================================
// Postman collection v2.x
// ============================================

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function kv(key: unknown, value: unknown, enabled = true, description?: unknown): KeyValuePair {
  return {
    id: nanoid(),
    key: str(key),
    value: str(value),
    enabled,
    ...(description ? { description: str(typeof description === "object" ? (description as any).content : description) } : {}),
  };
}

/** Postman auth params are [{key, value}] in v2.1 and {key: value} in v2.0 */
function authParams(params: unknown): Record<string, string> {
  if (Array.isArray(params)) {
    return Object.fromEntries(params.map((p: any) => [str(p?.key), str(p?.value)]));
  }
  if (params && typeof params === "object") {
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, str(v)]));
  }
  return {};
}

function convertAuth(auth: any): Pick<BackupRequest, "authType" | "authConfig"> | null {
  if (!auth || typeof auth !== "object") return null;
  switch (auth.type) {
    case "noauth":
      return { authType: "none", authConfig: {} };
    case "bearer": {
      const p = authParams(auth.bearer);
      return { authType: "bearer", authConfig: { token: p.token ?? "" } };
    }
    case "basic": {
      const p = authParams(auth.basic);
      return { authType: "basic", authConfig: { username: p.username ?? "", password: p.password ?? "" } };
    }
    case "apikey": {
      const p = authParams(auth.apikey);
      return {
        authType: "api-key",
        authConfig: {
          apiKeyName: p.key ?? "",
          apiKeyValue: p.value ?? "",
          apiKeyLocation: p.in === "query" ? "query" : "header",
        },
      };
    }
    default:
      return null;
  }
}

function convertUrl(url: any): { url: string; queryParams: KeyValuePair[] } {
  if (!url) return { url: "", queryParams: [] };
  if (typeof url === "string") {
    const qIndex = url.indexOf("?");
    const base = qIndex === -1 ? url : url.slice(0, qIndex);
    const query = qIndex === -1 ? "" : url.slice(qIndex + 1);
    const queryParams = query
      ? query.split("&").filter(Boolean).map((pair) => {
          const eq = pair.indexOf("=");
          const k = eq === -1 ? pair : pair.slice(0, eq);
          const v = eq === -1 ? "" : pair.slice(eq + 1);
          return kv(safeDecode(k), safeDecode(v));
        })
      : [];
    return { url: base, queryParams };
  }
  const raw = str(url.raw);
  const base = raw ? raw.split("?")[0] : buildUrlFromParts(url);
  const queryParams = Array.isArray(url.query)
    ? url.query
        .filter((q: any) => q && (q.key !== undefined || q.value !== undefined))
        .map((q: any) => kv(q.key, q.value, !q.disabled, q.description))
    : [];
  return { url: base, queryParams };
}

function buildUrlFromParts(url: any): string {
  const protocol = url.protocol ? `${url.protocol}://` : "";
  const host = Array.isArray(url.host) ? url.host.join(".") : str(url.host);
  const port = url.port ? `:${url.port}` : "";
  const path = Array.isArray(url.path) ? `/${url.path.join("/")}` : url.path ? `/${url.path}` : "";
  return `${protocol}${host}${port}${path}`;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function convertBody(
  body: any,
  headers: KeyValuePair[],
  warnings: string[],
  requestName: string
): Pick<BackupRequest, "body" | "bodyType"> {
  if (!body || !body.mode || body.disabled) return { body: null, bodyType: "none" };
  const hasHeader = (name: string) => headers.some((h) => h.key.toLowerCase() === name);

  switch (body.mode) {
    case "raw": {
      const language = body.options?.raw?.language;
      const raw = str(body.raw);
      const contentType = headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
      if (language === "json" || /json/i.test(contentType)) return { body: raw, bodyType: "json" };
      if (language === "xml" || /xml/i.test(contentType)) return { body: raw, bodyType: "xml" };
      return { body: raw, bodyType: "text" };
    }
    case "urlencoded": {
      const pairs = (body.urlencoded ?? []).filter((p: any) => !p.disabled);
      if (!hasHeader("content-type")) {
        headers.push(kv("Content-Type", "application/x-www-form-urlencoded"));
      }
      return {
        body: pairs.map((p: any) => `${encodeURIComponent(str(p.key))}=${encodeURIComponent(str(p.value))}`).join("&"),
        bodyType: "text",
      };
    }
    case "formdata": {
      const fields = (body.formdata ?? []).filter((p: any) => !p.disabled);
      if (fields.some((p: any) => p.type === "file")) {
        warnings.push(`“${requestName}”: file fields in form-data were skipped`);
      }
      // Multipart isn't editable yet — send text fields URL-encoded
      if (!hasHeader("content-type")) {
        headers.push(kv("Content-Type", "application/x-www-form-urlencoded"));
      }
      return {
        body: fields
          .filter((p: any) => p.type !== "file")
          .map((p: any) => `${encodeURIComponent(str(p.key))}=${encodeURIComponent(str(p.value))}`)
          .join("&"),
        bodyType: "text",
      };
    }
    case "graphql": {
      let variables: unknown = undefined;
      try {
        variables = body.graphql?.variables ? JSON.parse(body.graphql.variables) : undefined;
      } catch {
        variables = undefined;
      }
      if (!hasHeader("content-type")) headers.push(kv("Content-Type", "application/json"));
      return {
        body: JSON.stringify({ query: str(body.graphql?.query), ...(variables ? { variables } : {}) }, null, 2),
        bodyType: "json",
      };
    }
    case "file":
      warnings.push(`“${requestName}”: binary file body was skipped`);
      return { body: null, bodyType: "none" };
    default:
      return { body: null, bodyType: "none" };
  }
}

function convertPostmanCollection(data: any, backup: BackupFile, warnings: string[]) {
  const collection: BackupCollection = {
    id: nanoid(),
    name: str(data.info?.name).trim().slice(0, 200) || "Imported collection",
    description: typeof data.info?.description === "string" ? data.info.description.slice(0, 10_000) : "",
    variables: Object.fromEntries(
      (Array.isArray(data.variable) ? data.variable : [])
        .filter((v: any) => v?.key)
        .map((v: any) => [str(v.key), str(v.value)])
    ),
    folders: [],
  };
  backup.collections.push(collection);

  const walk = (items: any[], folderId: string | null, inheritedAuth: any) => {
    for (const item of items ?? []) {
      if (!item || typeof item !== "object") continue;
      if (Array.isArray(item.item)) {
        const folder = {
          id: nanoid(),
          parentFolderId: folderId,
          name: str(item.name).trim().slice(0, 200) || "Folder",
        };
        collection.folders.push(folder);
        walk(item.item, folder.id, item.auth ?? inheritedAuth);
        continue;
      }
      const request = typeof item.request === "string" ? { url: item.request, method: "GET" } : item.request;
      if (!request) continue;

      const name = str(item.name).trim().slice(0, 200) || "Request";
      const method = str(request.method || "GET").toUpperCase();
      if (!(HTTP_METHODS as readonly string[]).includes(method)) {
        warnings.push(`“${name}”: ${method} isn't supported — skipped`);
        continue;
      }

      const headers: KeyValuePair[] = (Array.isArray(request.header) ? request.header : [])
        .filter((h: any) => h?.key)
        .map((h: any) => kv(h.key, h.value, !h.disabled, h.description));
      const { url, queryParams } = convertUrl(request.url);
      const body = convertBody(request.body, headers, warnings, name);
      // "inherit" (or no auth) falls back to the folder / collection auth
      const auth =
        (request.auth && request.auth.type !== "inherit" ? convertAuth(request.auth) : null) ??
        convertAuth(inheritedAuth) ?? { authType: "none" as const, authConfig: {} };

      backup.requests.push({
        collectionId: collection.id,
        folderId,
        name,
        method: method as HttpMethod,
        url: url.slice(0, 4096),
        headers,
        queryParams,
        ...body,
        ...auth,
      });
    }
  };

  walk(data.item, null, data.auth);

  if ((data.event ?? []).length || JSON.stringify(data.item).includes('"event"')) {
    warnings.push("Pre-request and test scripts aren't supported and were not imported");
  }
}

function convertPostmanEnvironment(data: any): BackupEnvironment {
  return {
    name: str(data.name).trim().slice(0, 200) || "Imported environment",
    variables: (data.values ?? [])
      .filter((v: any) => v?.key)
      .slice(0, 500)
      .map((v: any) => ({ key: str(v.key), value: str(v.value), isSecret: v.type === "secret" })),
  };
}
