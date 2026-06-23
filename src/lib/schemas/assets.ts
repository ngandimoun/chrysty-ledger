import { z } from "zod";

import type { WorkspaceAsset } from "@/lib/asset-types";
import { WorkspaceArtifactSchema } from "@/lib/schemas/artifacts";

const AssetCategorySchema = z.enum([
  "sheet",
  "dashboard",
  "report",
  "invoice",
  "export",
  "chart",
]);

export const WorkspaceAssetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  category: AssetCategorySchema,
  kind: z.string(),
  payload: WorkspaceArtifactSchema,
  sourceMessageId: z.string().optional(),
  creationSequence: z.number(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function parseWorkspaceAsset(raw: unknown): WorkspaceAsset {
  return WorkspaceAssetSchema.parse(raw) as WorkspaceAsset;
}

export function safeParseWorkspaceAsset(raw: unknown) {
  return WorkspaceAssetSchema.safeParse(raw);
}
