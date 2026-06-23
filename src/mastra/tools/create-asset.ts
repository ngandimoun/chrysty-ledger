import { createAssetV2 } from "@/lib/assets/service";
import { artifactToAssetV2, assetV2ToWorkspaceAsset } from "@/lib/assets/adapters/legacy";
import type { AssetDefinitionInput } from "@/lib/assets/asset";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { nextCreationSequence, nextAssetSequence, insertAssetEvent } from "@/lib/ledger/events";
import type { LedgerScope } from "@/lib/ledger/scope";
import type { WorkspaceAsset } from "@/lib/asset-types";
import { upsertAsset } from "@/lib/ledger/assets";
import { getLedgerScopeFromContext } from "@/mastra/request-context";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const AssetDefinitionInputSchema = z.object({
  workspaceId: z.string(),
  kind: z.string(),
  subtype: z.string().nullable().optional(),
  title: z.string(),
  schema: z.record(z.string(), z.unknown()).default({}),
  data: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  batchCount: z.number().optional(),
});

export async function persistWorkspaceAssetV2(
  scope: LedgerScope,
  input: AssetDefinitionInput
): Promise<{ asset: WorkspaceAsset }> {
  const creationSequence = await nextCreationSequence(scope, input.workspaceId);
  const result = await createAssetV2(scope, {
    ...input,
    creationSequence,
  });

  if ("error" in result) {
    throw new Error(result.error.message);
  }

  const workspaceAsset = assetV2ToWorkspaceAsset(result.asset);
  await upsertAsset(scope, workspaceAsset);

  const eventSequence = await nextAssetSequence(scope, input.workspaceId);
  await insertAssetEvent(scope, {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    assetId: workspaceAsset.id,
    sequence: eventSequence,
    type: "asset_created",
    occurredAt: workspaceAsset.createdAt,
    title: workspaceAsset.title,
    version: workspaceAsset.version,
    payload: workspaceAsset.payload,
  });

  return { asset: workspaceAsset };
}

/** @deprecated Use persistWorkspaceAssetV2 with schema/data definitions */
export async function persistWorkspaceAsset(
  scope: LedgerScope,
  workspaceId: string,
  artifact: WorkspaceArtifact
): Promise<{ asset: WorkspaceAsset }> {
  const assetV2 = artifactToAssetV2(artifact, workspaceId);
  return persistWorkspaceAssetV2(scope, {
    workspaceId,
    kind: assetV2.kind,
    subtype: assetV2.subtype,
    title: assetV2.title,
    schema: assetV2.schema,
    data: assetV2.data,
    metadata: assetV2.metadata,
    relations: assetV2.relations,
    id: assetV2.id,
  });
}

export const createAssetTool = createTool({
  id: "create-asset",
  description: "Create a validated workspace asset from schema + data definition (no UI code).",
  requireApproval: async (inputData) => (inputData.batchCount ?? 1) > 1,
  inputSchema: AssetDefinitionInputSchema,
  outputSchema: z.object({
    asset: z.object({
      id: z.string(),
      title: z.string(),
      kind: z.string(),
    }),
  }),
  execute: async (inputData, context) => {
    const scope = getLedgerScopeFromContext(context?.requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    await context?.writer?.custom({
      type: "data-asset-created",
      data: { status: "pending", title: inputData.title },
      transient: true,
    });

    const result = await persistWorkspaceAssetV2(scope, inputData);

    await context?.writer?.custom({
      type: "data-asset-created",
      data: { status: "success", assetId: result.asset.id, title: result.asset.title },
      transient: true,
    });

    return {
      asset: {
        id: result.asset.id,
        title: result.asset.title,
        kind: result.asset.kind,
      },
    };
  },
});
