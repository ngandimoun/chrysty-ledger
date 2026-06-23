import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { FileRef } from "@/lib/chat-types";

export type AssetEventType = "asset_created" | "asset_updated" | "files_uploaded";

export type AssetEvent = {
  id: string;
  workspaceId: string;
  sequence: number;
  type: AssetEventType;
  occurredAt: string;
  assetId?: string;
  version?: number;
  title?: string;
  payload?: WorkspaceArtifact;
  files?: FileRef[];
  sourceMessageId?: string;
};
