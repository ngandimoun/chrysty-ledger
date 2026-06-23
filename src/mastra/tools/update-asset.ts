import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { listAssets, upsertAsset } from "@/lib/ledger/assets";
import { nextAssetSequence, insertAssetEvent } from "@/lib/ledger/events";
import { WorkspaceArtifactSchema } from "@/lib/schemas/artifacts";
import { WorkspaceAssetSchema } from "@/lib/schemas/assets";
import { applyArtifactRegistration } from "@/lib/workspace-assets";
import { getLedgerScopeFromContext } from "@/mastra/request-context";

export const updateAssetTool = createTool({
  id: "update-asset",
  description: "Update an existing workspace asset with a new artifact payload.",
  requireApproval: true,
  inputSchema: z.object({
    workspaceId: z.string(),
    assetId: z.string(),
    artifact: WorkspaceArtifactSchema,
  }),
  outputSchema: z.object({
    asset: WorkspaceAssetSchema,
  }),
  execute: async (inputData, context) => {
    const scope = getLedgerScopeFromContext(context?.requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const existingAssets = await listAssets(scope, inputData.workspaceId);
    const { asset } = applyArtifactRegistration({
      workspaceId: inputData.workspaceId,
      artifact: { ...inputData.artifact, id: inputData.assetId },
      existingAssets,
    });

    await upsertAsset(scope, asset);

    await insertAssetEvent(scope, {
      id: crypto.randomUUID(),
      workspaceId: inputData.workspaceId,
      assetId: asset.id,
      sequence: await nextAssetSequence(scope, inputData.workspaceId),
      type: "asset_updated",
      occurredAt: asset.updatedAt,
      title: asset.title,
      version: asset.version,
      payload: asset.payload,
    });

    return { asset };
  },
});
