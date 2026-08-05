import { z } from "zod";

export const createScheduleSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  name: z.string().min(1, "Schedule name is required").max(200),
  intervalSeconds: z
    .number()
    .int()
    .min(10, "Minimum interval is 10 seconds")
    .max(86400, "Maximum interval is 24 hours")
    .default(60),
  cronExpression: z
    .string()
    .regex(
      /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/,
      "Invalid cron expression"
    )
    .optional(),
  isActive: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(3),
});

export const updateScheduleSchema = createScheduleSchema.partial().omit({
  requestId: true,
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
