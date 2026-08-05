import { z } from "zod";

export const createCollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required").max(200),
  description: z.string().max(1000).default(""),
  defaultHeaders: z
    .array(
      z.object({
        id: z.string(),
        key: z.string(),
        value: z.string(),
        enabled: z.boolean().default(true),
      })
    )
    .default([]),
  variables: z.record(z.string()).default({}),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const createFolderSchema = z.object({
  collectionId: z.string().min(1),
  parentFolderId: z.string().optional(),
  name: z.string().min(1, "Folder name is required").max(200),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentFolderId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
