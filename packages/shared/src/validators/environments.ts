import { z } from "zod";

export const createEnvironmentSchema = z.object({
  name: z.string().min(1, "Environment name is required").max(100),
  isActive: z.boolean().default(false),
});

export const updateEnvironmentSchema = createEnvironmentSchema.partial();

export const createVariableSchema = z.object({
  environmentId: z.string().min(1),
  key: z.string().min(1, "Variable key is required").max(200),
  value: z.string().max(4096).default(""),
  isSecret: z.boolean().default(false),
});

export const updateVariableSchema = z.object({
  key: z.string().min(1).max(200).optional(),
  value: z.string().max(4096).optional(),
  isSecret: z.boolean().optional(),
});

export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;
export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>;
export type CreateVariableInput = z.infer<typeof createVariableSchema>;
export type UpdateVariableInput = z.infer<typeof updateVariableSchema>;
