import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { listAssets as listLedgerAssets } from "@/lib/ledger/assets";
import { WorkspaceAssetSchema } from "@/lib/schemas/assets";
import { getLedgerScopeFromContext } from "@/mastra/request-context";

export const listAssetsTool = createTool({
  id: "list-assets",
  description: "List all assets in the current workspace.",
  inputSchema: z.object({
    workspaceId: z.string(),
  }),
  outputSchema: z.object({
    assets: z.array(WorkspaceAssetSchema),
  }),
  execute: async (inputData, context) => {
    const scope = getLedgerScopeFromContext(context?.requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const assets = await listLedgerAssets(scope, inputData.workspaceId);
    return { assets };
  },
});
