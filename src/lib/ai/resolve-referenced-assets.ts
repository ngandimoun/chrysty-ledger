import "server-only";

import type { Asset } from "@/lib/assets/asset";
import { getAssetV2 } from "@/lib/assets/service";
import { limitContextTokens } from "@/lib/agent/ledger-guardrails";
import type { AttachmentInput } from "@/lib/ai/types";
import type { AssetRef } from "@/lib/chat-types";
import type { LedgerScope } from "@/lib/ledger/scope";
import { downloadWorkspaceFile } from "@/lib/storage/workspace-files";

const STRUCTURED_ASSET_KINDS = new Set(["table", "chart", "dashboard", "document", "invoice"]);
const MAX_TABLE_ROWS = 50;

export type ResolveReferencedAssetsResult = {
  attachments: AttachmentInput[];
  systemMessages: string[];
  resolved: AssetRef[];
  referencedAssetIds: string[];
};

function assetToRef(asset: Asset): AssetRef {
  const category =
    asset.kind === "table"
      ? "sheet"
      : asset.kind === "document"
        ? "report"
        : asset.kind === "file"
          ? "files"
          : asset.kind === "chart"
            ? "chart"
            : asset.kind === "dashboard"
              ? "dashboard"
              : asset.kind === "invoice"
                ? "invoice"
                : "export";

  return {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    category,
  };
}

function truncateAssetData(asset: Asset): Record<string, unknown> {
  const data = { ...asset.data };

  if (asset.kind === "table" && Array.isArray(data.rows)) {
    const rows = data.rows as unknown[];
    if (rows.length > MAX_TABLE_ROWS) {
      data.rows = rows.slice(0, MAX_TABLE_ROWS);
      data._truncated = true;
      data._totalRows = rows.length;
    }
  }

  return data;
}

function buildStructuredAssetContext(asset: Asset): string {
  const payload = {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    subtype: asset.subtype,
    schema: asset.schema,
    data: truncateAssetData(asset),
  };

  return limitContextTokens(
    `Referenced workspace asset "${asset.title}" (${asset.kind}, id=${asset.id}):\n${JSON.stringify(payload, null, 2)}`,
    4_000
  );
}

function guessMimeType(filename: string, fallback?: string): string {
  if (fallback?.trim()) return fallback;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function resolveFileAsset(
  scope: LedgerScope,
  asset: Asset
): Promise<AttachmentInput | null> {
  const storageRef = String(asset.data.storageRef ?? "");
  if (!storageRef || storageRef.startsWith("legacy-file-list:") || storageRef.startsWith("pending://")) {
    return null;
  }

  try {
    const buffer = await downloadWorkspaceFile(scope, storageRef);
    const filename = String(asset.schema.filename ?? asset.title ?? "file");
    const mimeType = guessMimeType(
      filename,
      String(asset.schema.mimeType ?? asset.metadata.mimeType ?? "")
    );

    return { buffer, filename, mimeType, sourceAssetId: asset.id };
  } catch (error) {
    console.warn("[resolveReferencedAssets] file download failed:", asset.id, error);
    return null;
  }
}

export async function resolveReferencedAssets(input: {
  scope: LedgerScope;
  workspaceId: string;
  assetIds: string[];
}): Promise<ResolveReferencedAssetsResult> {
  const uniqueIds = [...new Set(input.assetIds.map((id) => id.trim()).filter(Boolean))];
  const attachments: AttachmentInput[] = [];
  const systemMessages: string[] = [];
  const resolved: AssetRef[] = [];

  for (const assetId of uniqueIds) {
    const asset = await getAssetV2(input.scope, input.workspaceId, assetId);
    if (!asset || asset.archivedAt) {
      console.warn("[resolveReferencedAssets] asset not found:", assetId);
      continue;
    }

    const ref = assetToRef(asset);
    resolved.push(ref);

    if (asset.kind === "file") {
      const attachment = await resolveFileAsset(input.scope, asset);
      if (attachment) {
        attachments.push(attachment);
      } else {
        systemMessages.push(
          `Referenced file asset "${asset.title}" (id=${asset.id}) could not be loaded from storage.`
        );
      }
      continue;
    }

    if (STRUCTURED_ASSET_KINDS.has(asset.kind)) {
      systemMessages.push(buildStructuredAssetContext(asset));
      continue;
    }

    systemMessages.push(
      `Referenced workspace asset "${asset.title}" (${asset.kind}, id=${asset.id}) is available in this workspace.`
    );
  }

  return {
    attachments,
    systemMessages,
    resolved,
    referencedAssetIds: resolved.map((item) => item.id),
  };
}

export function pickReferencedStructuredTargetAssetId(
  resolved: AssetRef[],
  kinds: Set<string> = STRUCTURED_ASSET_KINDS
): string | undefined {
  const structured = resolved.filter((ref) => kinds.has(ref.kind));
  if (structured.length === 1) {
    return structured[0]?.id;
  }
  return undefined;
}
