import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { listAssets } from "@/lib/ledger/assets";
import { nextAssetSequence, insertAssetEvent } from "@/lib/ledger/events";
import { getLedgerScopeFromContext } from "@/mastra/request-context";

export const deleteAssetTool = createTool({
  id: "delete-asset",
  description: "Delete a workspace asset by id.",
  requireApproval: true,
  inputSchema: z.object({
    workspaceId: z.string(),
    assetId: z.string(),
  }),
  outputSchema: z.object({
    deleted: z.boolean(),
    assetId: z.string(),
  }),
  execute: async (inputData, context) => {
    const scope = getLedgerScopeFromContext(context?.requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const assets = await listAssets(scope, inputData.workspaceId);
    const asset = assets.find((item) => item.id === inputData.assetId);
    if (!asset) {
      return { deleted: false, assetId: inputData.assetId };
    }

    const { error } = await scope.supabase
      .from("ledger_assets")
      .delete()
      .eq("workspace_id", inputData.workspaceId)
      .eq("id", inputData.assetId);

    if (error) throw error;

    await insertAssetEvent(scope, {
      id: crypto.randomUUID(),
      workspaceId: inputData.workspaceId,
      assetId: asset.id,
      sequence: await nextAssetSequence(scope, inputData.workspaceId),
      type: "asset_updated",
      occurredAt: new Date().toISOString(),
      title: asset.title,
    });

    return { deleted: true, assetId: inputData.assetId };
  },
});
