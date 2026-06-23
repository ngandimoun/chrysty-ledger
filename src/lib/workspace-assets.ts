import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { parseWorkspaceArtifact } from "@/lib/schemas/artifacts";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CATEGORY_ORDER,
  type AssetCategory,
  type GroupedAssets,
  type WorkspaceAsset,
} from "@/lib/asset-types";
import type { ChatMessage, FileRef } from "@/lib/chat-types";

export type ArtifactRegistrationInput = {
  workspaceId: string;
  artifact: WorkspaceArtifact;
  sourceMessageId?: string;
  occurredAt?: string;
  existingAssets: WorkspaceAsset[];
  recordEvent?: boolean;
  creationSequence?: number;
};

export function inferCategoryFromArtifact(artifact: WorkspaceArtifact): AssetCategory {
  if (artifact.kind === "table") return "sheet";
  if (artifact.kind === "file-list") return "files";
  if (artifact.kind === "document") return "report";
  if (artifact.kind === "dashboard") return "dashboard";
  if (artifact.kind === "invoice") return "invoice";
  if (artifact.kind === "chart") {
    const title = artifact.title.toLowerCase();
    if (title.includes("dashboard")) return "dashboard";
    return "chart";
  }
  return "sheet";
}

function nextInMemorySequence(assets: WorkspaceAsset[]): number {
  if (assets.length === 0) return 1;
  return Math.max(...assets.map((asset) => asset.creationSequence), 0) + 1;
}

export function assetNeedsMetadataBackfill(asset: WorkspaceAsset): boolean {
  return (
    typeof asset.creationSequence !== "number" ||
    !Number.isFinite(asset.creationSequence) ||
    typeof asset.version !== "number" ||
    !Number.isFinite(asset.version)
  );
}

export function backfillAssetMetadata(
  workspaceId: string,
  assets: WorkspaceAsset[]
): WorkspaceAsset[] {
  if (assets.every((asset) => !assetNeedsMetadataBackfill(asset))) {
    return assets;
  }

  const sorted = [...assets]
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const timeDiff =
        new Date(a.asset.createdAt).getTime() - new Date(b.asset.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.index - b.index;
    });

  let sequence = Math.max(...assets.map((asset) => asset.creationSequence), 0);
  const sequenceById = new Map<string, number>();

  for (const { asset } of sorted) {
    if (!assetNeedsMetadataBackfill(asset)) {
      sequenceById.set(asset.id, asset.creationSequence);
      sequence = Math.max(sequence, asset.creationSequence);
      continue;
    }
    sequence += 1;
    sequenceById.set(asset.id, sequence);
  }

  return assets.map((asset) => ({
    ...asset,
    workspaceId,
    creationSequence:
      sequenceById.get(asset.id) ??
      asset.creationSequence ??
      nextInMemorySequence(assets),
    version:
      typeof asset.version === "number" && Number.isFinite(asset.version)
        ? asset.version
        : 1,
  }));
}

export type ArtifactRegistrationResult = {
  asset: WorkspaceAsset;
  assets: WorkspaceAsset[];
  isCreate: boolean;
};

export function applyArtifactRegistration({
  workspaceId,
  artifact,
  sourceMessageId,
  occurredAt,
  existingAssets,
  creationSequence,
}: ArtifactRegistrationInput): ArtifactRegistrationResult {
  const validatedArtifact = parseWorkspaceArtifact(artifact);
  const timestamp = occurredAt ?? new Date().toISOString();
  const index = existingAssets.findIndex((item) => item.id === validatedArtifact.id);

  if (index >= 0) {
    const existing = existingAssets[index];
    const version = existing.version + 1;
    const asset: WorkspaceAsset = {
      ...existing,
      title: validatedArtifact.title,
      category: inferCategoryFromArtifact(validatedArtifact),
      kind: validatedArtifact.kind,
      payload: validatedArtifact,
      sourceMessageId: sourceMessageId ?? existing.sourceMessageId,
      version,
      updatedAt: timestamp,
    };

    const assets = existingAssets.map((item, i) => (i === index ? asset : item));
    return { asset, assets, isCreate: false };
  }

  const asset: WorkspaceAsset = {
    id: validatedArtifact.id,
    workspaceId,
    title: validatedArtifact.title,
    category: inferCategoryFromArtifact(validatedArtifact),
    kind: validatedArtifact.kind,
    payload: validatedArtifact,
    sourceMessageId,
    creationSequence: creationSequence ?? nextInMemorySequence(existingAssets),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    asset,
    assets: [...existingAssets, asset],
    isCreate: true,
  };
}

export function createAssetFromArtifact(
  workspaceId: string,
  artifact: WorkspaceArtifact,
  sourceMessageId?: string,
  occurredAt?: string,
  creationSequence?: number
): WorkspaceAsset {
  const timestamp = occurredAt ?? new Date().toISOString();
  return {
    id: artifact.id,
    workspaceId,
    title: artifact.title,
    category: inferCategoryFromArtifact(artifact),
    kind: artifact.kind,
    payload: artifact,
    sourceMessageId,
    creationSequence: creationSequence ?? 1,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type ResolveAssetForOpenInput = {
  assetId: string;
  workspaceId: string;
  assets: WorkspaceAsset[];
  displayAssets: WorkspaceAsset[];
  artifact?: WorkspaceArtifact;
};

function matchAssetByTitleAndKind(
  assets: WorkspaceAsset[],
  artifact: WorkspaceArtifact
): WorkspaceAsset | undefined {
  const normalizedTitle = artifact.title.trim().toLowerCase();
  return assets.find(
    (asset) =>
      asset.kind === artifact.kind && asset.title.trim().toLowerCase() === normalizedTitle
  );
}

export function resolveAssetForOpen(input: ResolveAssetForOpenInput): WorkspaceAsset | null {
  const direct = input.assets.find((asset) => asset.id === input.assetId);
  if (direct) return direct;

  if (!input.artifact) {
    return null;
  }

  const byTitleKind = matchAssetByTitleAndKind(input.displayAssets, input.artifact);
  if (byTitleKind) return byTitleKind;

  const byTitleKindFull = matchAssetByTitleAndKind(input.assets, input.artifact);
  if (byTitleKindFull) return byTitleKindFull;

  return createAssetFromArtifact(input.workspaceId, input.artifact);
}

export function sortDisplayAssets(assets: WorkspaceAsset[]): WorkspaceAsset[] {
  return [...assets].sort(
    (left, right) =>
      right.creationSequence - left.creationSequence ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function formatUploadSizeLabel(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function chatUploadKey(messageId: string, file: FileRef): string {
  return `${messageId}::${file.name.trim().toLowerCase()}`;
}

function buildSyntheticChatUploadId(messageId: string, index: number): string {
  return `chat-upload:${messageId}:${index}`;
}

function createChatUploadAsset(
  workspaceId: string,
  message: Extract<ChatMessage, { role: "user" }>,
  file: FileRef,
  assetId: string,
  creationSequence: number
): WorkspaceAsset {
  const artifact: WorkspaceArtifact = {
    id: assetId,
    kind: "file-list",
    title: file.name,
    files: [{ name: file.name, size: formatUploadSizeLabel(file.size) }],
  };

  return {
    id: assetId,
    workspaceId,
    title: file.name,
    category: "files",
    kind: "file-list",
    payload: artifact,
    sourceMessageId: message.id,
    creationSequence,
    version: 1,
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  };
}

export function mergeChatUploadsIntoAssets(
  workspaceId: string,
  assets: WorkspaceAsset[],
  messages: ChatMessage[]
): WorkspaceAsset[] {
  const merged = [...assets];
  const knownIds = new Set(merged.map((asset) => asset.id));
  const coveredChatUploads = new Set(
    merged
      .filter(
        (asset) =>
          asset.kind === "file-list" &&
          asset.sourceMessageId
      )
      .map((asset) => chatUploadKey(asset.sourceMessageId!, { name: asset.title, size: 0, type: "" }))
  );

  let sequence = Math.max(0, ...merged.map((asset) => asset.creationSequence));

  const userMessages = messages
    .filter(
      (message): message is Extract<ChatMessage, { role: "user" }> =>
        message.role === "user" && Boolean(message.files?.length)
    )
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );

  for (const message of userMessages) {
    for (const [index, file] of (message.files ?? []).entries()) {
      const uploadKey = chatUploadKey(message.id, file);

      if (file.assetId) {
        if (knownIds.has(file.assetId)) continue;
        sequence += 1;
        merged.push(
          createChatUploadAsset(workspaceId, message, file, file.assetId, sequence)
        );
        knownIds.add(file.assetId);
        coveredChatUploads.add(uploadKey);
        continue;
      }

      if (coveredChatUploads.has(uploadKey)) continue;

      const syntheticId = buildSyntheticChatUploadId(message.id, index);
      if (knownIds.has(syntheticId)) continue;

      sequence += 1;
      merged.push(
        createChatUploadAsset(workspaceId, message, file, syntheticId, sequence)
      );
      knownIds.add(syntheticId);
      coveredChatUploads.add(uploadKey);
    }
  }

  return merged;
}

const UPLOAD_KINDS = new Set(["file", "file-list"]);

function normalizeExplorerKind(kind: string): string {
  if (UPLOAD_KINDS.has(kind)) return "uploads";
  return kind || "other";
}

function explorerKindLabel(kind: string): string {
  if (kind === "uploads") return ASSET_CATEGORY_LABELS.files;
  return kind.charAt(0).toUpperCase() + kind.slice(1).replace(/-/g, " ");
}

function explorerKindCategory(kind: string): AssetCategory {
  if (kind === "uploads") return "files";
  return kind as AssetCategory;
}

const EXPLORER_GROUP_ORDER: Record<string, number> = {
  uploads: 0,
  table: 1,
  chart: 2,
  dashboard: 3,
  document: 4,
  invoice: 5,
};

function explorerGroupSortKey(kind: string): number {
  return EXPLORER_GROUP_ORDER[kind] ?? 100;
}

export function dedupeAssetsByTitleAndKind(assets: WorkspaceAsset[]): WorkspaceAsset[] {
  const byKey = new Map<string, WorkspaceAsset>();

  for (const asset of assets) {
    const key = `${asset.kind}::${asset.title.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, asset);
      continue;
    }

    const existingVersion = existing.version ?? 1;
    const nextVersion = asset.version ?? 1;
    if (
      nextVersion > existingVersion ||
      (nextVersion === existingVersion &&
        new Date(asset.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      byKey.set(key, asset);
    }
  }

  return Array.from(byKey.values());
}

export function groupAssetsByKind(assets: WorkspaceAsset[]): GroupedAssets[] {
  const buckets = new Map<string, WorkspaceAsset[]>();

  for (const asset of assets) {
    const kind = normalizeExplorerKind(asset.kind || "other");
    const list = buckets.get(kind) ?? [];
    list.push(asset);
    buckets.set(kind, list);
  }

  return Array.from(buckets.entries())
    .map(([kind, items]) => ({
      explorerKind: kind,
      category: explorerKindCategory(kind),
      label: explorerKindLabel(kind),
      assets: items.sort((a, b) => b.creationSequence - a.creationSequence),
    }))
    .sort(
      (a, b) =>
        explorerGroupSortKey(a.explorerKind) - explorerGroupSortKey(b.explorerKind) ||
        a.label.localeCompare(b.label)
    )
    .map(({ category, label, assets }) => ({ category, label, assets }));
}

export function groupAssetsByCategory(assets: WorkspaceAsset[]): GroupedAssets[] {
  const buckets = new Map<AssetCategory, WorkspaceAsset[]>();

  for (const category of ASSET_CATEGORY_ORDER) {
    buckets.set(category, []);
  }

  for (const asset of assets) {
    const list = buckets.get(asset.category) ?? [];
    list.push(asset);
    buckets.set(asset.category, list);
  }

  return ASSET_CATEGORY_ORDER.map((category) => ({
    category,
    label: ASSET_CATEGORY_LABELS[category],
    assets: (buckets.get(category) ?? []).sort(
      (a, b) => b.creationSequence - a.creationSequence
    ),
  })).filter((group) => group.assets.length > 0);
}

export function filterAssets(assets: WorkspaceAsset[], query: string): WorkspaceAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return assets;

  return assets.filter((asset) => {
    const categoryLabel = (
      ASSET_CATEGORY_LABELS[asset.category] ?? explorerKindLabel(normalizeExplorerKind(asset.kind))
    ).toLowerCase();
    return (
      asset.title.toLowerCase().includes(normalized) ||
      categoryLabel.includes(normalized) ||
      asset.kind.toLowerCase().includes(normalized)
    );
  });
}

export function resolveOccurredAt(
  messages: ChatMessage[],
  sourceMessageId?: string,
  fallback?: string
): string {
  if (sourceMessageId) {
    const message = messages.find((item) => item.id === sourceMessageId);
    if (message) return message.createdAt;
  }
  return fallback ?? new Date().toISOString();
}
