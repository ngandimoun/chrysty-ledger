import { createMessageId } from "@/lib/chat-types";

export type AssetRelation = {
  targetAssetId: string;
  relation: string;
};

export type Asset = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  kind: string;
  subtype?: string | null;
  title: string;
  schema: Record<string, unknown>;
  data: Record<string, unknown>;
  relations: AssetRelation[];
  metadata: Record<string, unknown>;
  version: number;
  creationSequence: number;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type AssetDefinitionInput = {
  id?: string;
  workspaceId: string;
  projectId?: string | null;
  kind: string;
  subtype?: string | null;
  title: string;
  schema?: Record<string, unknown>;
  data?: Record<string, unknown>;
  relations?: AssetRelation[];
  metadata?: Record<string, unknown>;
  sourceMessageId?: string;
  creationSequence?: number;
};

export type WorkspaceProject = {
  id: string;
  workspaceId: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function createAssetId(): string {
  return createMessageId();
}

export function createEmptyAsset(input: AssetDefinitionInput): Asset {
  const now = new Date().toISOString();
  return {
    id: input.id ?? createAssetId(),
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    kind: input.kind,
    subtype: input.subtype ?? null,
    title: input.title.trim() || "Untitled",
    schema: input.schema ?? {},
    data: input.data ?? {},
    relations: input.relations ?? [],
    metadata: input.metadata ?? {},
    version: 1,
    creationSequence: input.creationSequence ?? 1,
    sourceMessageId: input.sourceMessageId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}
