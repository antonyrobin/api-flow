import { z } from "zod";
import { HTTP_METHODS, BODY_TYPES, AUTH_TYPES } from "../constants/http";

// ============================================
// Key-Value Pair Validator
// ============================================

export const keyValuePairSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

// ============================================
// Auth Config Validator
// ============================================

export const authConfigSchema = z.object({
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKeyName: z.string().optional(),
  apiKeyValue: z.string().optional(),
  apiKeyLocation: z.enum(["header", "query"]).optional(),
  oauth2GrantType: z.enum(["authorization_code", "client_credentials"]).optional(),
  oauth2TokenUrl: z.string().url().optional(),
  oauth2ClientId: z.string().optional(),
  oauth2ClientSecret: z.string().optional(),
  oauth2Scope: z.string().optional(),
});

// ============================================
// Request Validators
// ============================================

export const createRequestSchema = z.object({
  collectionId: z.string().optional(),
  folderId: z.string().optional(),
  name: z.string().min(1, "Request name is required").max(200),
  method: z.enum(HTTP_METHODS).default("GET"),
  url: z.string().max(4096).default(""),
  headers: z.array(keyValuePairSchema).default([]),
  queryParams: z.array(keyValuePairSchema).default([]),
  body: z.string().nullable().default(null),
  bodyType: z.enum(BODY_TYPES).default("none"),
  authType: z.enum(AUTH_TYPES).default("none"),
  authConfig: authConfigSchema.default({}),
  preRequestScript: z.string().nullable().optional(),
  testScript: z.string().nullable().optional(),
});

export const updateRequestSchema = createRequestSchema.partial();

// ============================================
// Execute Request Validator (for proxy)
// ============================================

export const executeRequestSchema = z.object({
  method: z.enum(HTTP_METHODS),
  url: z.string().min(1, "URL is required").max(4096),
  headers: z.record(z.string()).default({}),
  body: z.string().nullable().default(null),
  timeout: z.number().min(1000).max(120000).default(30000),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type ExecuteRequestInput = z.infer<typeof executeRequestSchema>;
