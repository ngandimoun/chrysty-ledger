import "server-only";

import { createAssetId, type Asset } from "@/lib/assets/asset";
import { createAssetV2 } from "@/lib/assets/service";
import type { AttachmentInput, ChatSseEvent } from "@/lib/ai/types";
import { nextCreationSequence } from "@/lib/ledger/events";
import type { LedgerScope } from "@/lib/ledger/scope";
import { uploadWorkspaceFile } from "@/lib/storage/workspace-files";

export type PersistChatUploadsInput = {
  scope: LedgerScope;
  workspaceId: string;
  attachments: AttachmentInput[];
  sourceMessageId?: string;
  onEvent?: (event: ChatSseEvent) => void;
};

export async function persistChatUploads(input: PersistChatUploadsInput): Promise<Asset[]> {
  const assets: Asset[] = [];
  if (input.attachments.length === 0) return assets;

  let creationSequence = await nextCreationSequence(input.scope, input.workspaceId);

  for (const attachment of input.attachments) {
    const assetId = createAssetId();

    try {
      const uploaded = await uploadWorkspaceFile(input.scope, {
        workspaceId: input.workspaceId,
        assetId,
        buffer: attachment.buffer,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
      });

      const result = await createAssetV2(input.scope, {
        id: assetId,
        workspaceId: input.workspaceId,
        kind: "file",
        subtype: "upload",
        title: attachment.filename,
        schema: { filename: attachment.filename, mimeType: attachment.mimeType },
        data: {
          storageRef: uploaded.storageRef,
          size: attachment.buffer.byteLength,
        },
        metadata: { mimeType: attachment.mimeType },
        sourceMessageId: input.sourceMessageId,
        creationSequence,
      });

      creationSequence += 1;

      if ("error" in result) {
        console.error("[persistChatUploads] createAssetV2 failed:", result.error);
        input.onEvent?.({
          type: "error",
          message: `Failed to save upload "${attachment.filename}": ${result.error.message}`,
        });
        continue;
      }

      assets.push(result.asset);
      input.onEvent?.({ type: "asset_created", asset: result.asset });
    } catch (error) {
      console.error("[persistChatUploads] upload failed:", error);
      input.onEvent?.({
        type: "error",
        message: `Failed to upload "${attachment.filename}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  return assets;
}
