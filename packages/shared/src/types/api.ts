import type { HttpMethod, BodyType, AuthType } from "../constants/http";

// ============================================
// Key-Value Pair (used in headers, params, etc.)
// ============================================

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// ============================================
// API Request Types
// ============================================

export interface ApiRequest {
  id: string;
  collectionId?: string;
  folderId?: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: string | null;
  bodyType: BodyType;
  authType: AuthType;
  authConfig: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
}

export interface AuthConfig {
  // Bearer token
  token?: string;
  // Basic auth
  username?: string;
  password?: string;
  // API key
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyLocation?: "header" | "query";
  // OAuth2
  oauth2GrantType?: "authorization_code" | "client_credentials";
  oauth2TokenUrl?: string;
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2Scope?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
  timing: RequestTiming;
  timestamp: string;
}

export interface RequestTiming {
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  downloadMs?: number;
  totalMs: number;
}

// ============================================
// Collection Types
// ============================================

export interface Collection {
  id: string;
  name: string;
  description: string;
  defaultHeaders: KeyValuePair[];
  variables: Record<string, string>;
  folders: CollectionFolder[];
  requests: ApiRequest[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionFolder {
  id: string;
  collectionId: string;
  parentFolderId?: string;
  name: string;
  sortOrder: number;
  folders: CollectionFolder[];
  requests: ApiRequest[];
}

// ============================================
// Environment Types
// ============================================

export interface Environment {
  id: string;
  name: string;
  isActive: boolean;
  variables: EnvironmentVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

// ============================================
// Schedule Types
// ============================================

export interface Schedule {
  id: string;
  requestId: string;
  name: string;
  intervalSeconds: number;
  cronExpression?: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleLog {
  id: string;
  scheduleId: string;
  statusCode?: number;
  timingTotalMs?: number;
  isSuccess: boolean;
  errorMessage?: string;
  createdAt: string;
}

// ============================================
// Request History Types
// ============================================

export interface RequestHistoryEntry {
  id: string;
  requestId?: string;
  method: string;
  url: string;
  statusCode?: number;
  responseSizeBytes?: number;
  timing: RequestTiming;
  errorMessage?: string;
  createdAt: string;
}
