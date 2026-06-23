import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { listAssets as listLedgerAssets } from "@/lib/ledger/assets";
import { WorkspaceAssetSchema } from "@/lib/schemas/assets";
import { getLedgerScopeFromContext } from "@/mastra/request-context";

export const getAssetTool = createTool({
  id: "get-asset",
  description: "Get a single workspace asset by id.",
  inputSchema: z.object({
    workspaceId: z.string(),
    assetId: z.string(),
  }),
  outputSchema: z.object({
    asset: WorkspaceAssetSchema.nullable(),
  }),
  execute: async (inputData, context) => {
    const scope = getLedgerScopeFromContext(context?.requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const assets = await listLedgerAssets(scope, inputData.workspaceId);
    const asset = assets.find((item) => item.id === inputData.assetId) ?? null;
    return { asset };
  },
});
