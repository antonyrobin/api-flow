import { z } from "zod";
import { HTTP_METHODS } from "../constants/http";

export const MONITOR_LIMITS = {
  maxMonitorsPerUser: 50,
  maxChecksPerRun: 25,
  minIntervalSeconds: 10,
  maxIntervalSeconds: 86400,
} as const;

export const createMonitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  method: z.enum(HTTP_METHODS).default("GET"),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL including http:// or https://")
    .max(2048)
    .refine((u) => /^https?:\/\//i.test(u), "Only http:// and https:// URLs are supported"),
  headers: z.record(z.string().max(4096)).default({}),
  body: z.string().max(64 * 1024).nullable().default(null),
  intervalSeconds: z
    .number()
    .int()
    .min(MONITOR_LIMITS.minIntervalSeconds, "Minimum interval is 10 seconds")
    .max(MONITOR_LIMITS.maxIntervalSeconds, "Maximum interval is 24 hours")
    .default(60),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  expectedStatus: z.number().int().min(100).max(599).nullable().default(null),
  isEnabled: z.boolean().default(true),
  runInBackground: z.boolean().default(false),
});

export const updateMonitorSchema = createMonitorSchema.partial();

export const runMonitorsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MONITOR_LIMITS.maxChecksPerRun),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type RunMonitorsInput = z.infer<typeof runMonitorsSchema>;
