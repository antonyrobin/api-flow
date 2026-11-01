import { z } from "zod";
import { HTTP_METHODS, BODY_TYPES, AUTH_TYPES } from "../constants/http";
import { keyValuePairSchema, authConfigSchema } from "./requests";

/**
 * API Flow backup file (also the target format the web app converts
 * Postman collections / environments into before importing).
 *
 * `id`, `collectionId`, `folderId` and `parentFolderId` are references
 * inside the file only — the server assigns fresh ids on import.
 */
export const BACKUP_FORMAT = "api-flow-backup";
export const BACKUP_VERSION = 1;

export const BACKUP_LIMITS = {
  collections: 200,
  folders: 2000,
  requests: 3000,
  environments: 100,
  variablesPerEnvironment: 500,
} as const;

const ref = z.string().min(1).max(64);

export const backupFolderSchema = z.object({
  id: ref,
  parentFolderId: ref.nullable().optional(),
  name: z.string().trim().min(1).max(200),
});

export const backupCollectionSchema = z.object({
  id: ref,
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullable().optional(),
  variables: z.record(z.string()).optional(),
  folders: z.array(backupFolderSchema).max(BACKUP_LIMITS.folders).default([]),
});

export const backupRequestSchema = z.object({
  collectionId: ref.nullable().optional(),
  folderId: ref.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  method: z.enum(HTTP_METHODS).default("GET"),
  url: z.string().max(4096).default(""),
  headers: z.array(keyValuePairSchema).max(200).default([]),
  queryParams: z.array(keyValuePairSchema).max(200).default([]),
  body: z.string().max(512 * 1024).nullable().default(null),
  bodyType: z.enum(BODY_TYPES).default("none"),
  authType: z.enum(AUTH_TYPES).default("none"),
  // Lenient: imported files may contain non-URL token endpoints etc.
  authConfig: authConfigSchema.partial().catch({}).default({}),
});

export const backupEnvironmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  variables: z
    .array(
      z.object({
        key: z.string().max(500),
        value: z.string().max(64 * 1024).default(""),
        isSecret: z.boolean().default(false),
      })
    )
    .max(BACKUP_LIMITS.variablesPerEnvironment)
    .default([]),
});

export const backupMonitorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  method: z.enum(HTTP_METHODS).default("GET"),
  url: z.string().trim().max(2048),
  headers: z.record(z.string().max(4096)).default({}),
  body: z.string().max(64 * 1024).nullable().default(null),
  intervalSeconds: z.number().int().min(10).max(86400).default(60),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  expectedStatus: z.number().int().min(100).max(599).nullable().default(null),
  isEnabled: z.boolean().default(true),
  runInBackground: z.boolean().default(false),
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  collections: z.array(backupCollectionSchema).max(BACKUP_LIMITS.collections).default([]),
  requests: z.array(backupRequestSchema).max(BACKUP_LIMITS.requests).default([]),
  environments: z.array(backupEnvironmentSchema).max(BACKUP_LIMITS.environments).default([]),
  monitors: z.array(backupMonitorSchema).max(50).default([]),
});

export type BackupFolder = z.infer<typeof backupFolderSchema>;
export type BackupCollection = z.infer<typeof backupCollectionSchema>;
export type BackupRequest = z.infer<typeof backupRequestSchema>;
export type BackupEnvironment = z.infer<typeof backupEnvironmentSchema>;
export type BackupMonitor = z.infer<typeof backupMonitorSchema>;
export type BackupFile = z.infer<typeof backupSchema>;

export interface ImportSummary {
  collections: number;
  folders: number;
  requests: number;
  environments: number;
  monitors: number;
  skippedMonitors: number;
}
