import type { ChatMessage } from "@/lib/chat-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import {
  applyArtifactRegistration,
  backfillAssetMetadata,
} from "@/lib/workspace-assets";

export function migrateMessagesToAssets(
  workspaceId: string,
  messages: ChatMessage[],
  existingAssets: WorkspaceAsset[] = []
): WorkspaceAsset[] {
  let assets = backfillAssetMetadata(workspaceId, existingAssets);
  const existingIds = new Set(assets.map((asset) => asset.id));

  const artifactMessages = messages
    .filter(
      (message): message is Extract<ChatMessage, { type: "artifact" }> =>
        message.type === "artifact"
    )
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  for (const message of artifactMessages) {
    if (existingIds.has(message.artifact.id)) continue;

    const result = applyArtifactRegistration({
      workspaceId,
      artifact: message.artifact,
      sourceMessageId: message.id,
      occurredAt: message.createdAt,
      existingAssets: assets,
    });
    assets = result.assets;
    existingIds.add(message.artifact.id);
  }

  return assets;
}
