import type { AssetCategory } from "@/lib/asset-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import type { AssetRef } from "@/lib/chat-types";
import {
  BarChart3,
  Download,
  FileText,
  Image,
  LayoutDashboard,
  Receipt,
  Table2,
} from "lucide-react";

export function getAssetCategoryIcon(category: AssetCategory) {
  switch (category) {
    case "sheet":
      return Table2;
    case "dashboard":
      return LayoutDashboard;
    case "chart":
      return BarChart3;
    case "report":
      return FileText;
    case "invoice":
      return Receipt;
    case "export":
      return Download;
    case "files":
      return Image;
    default:
      return FileText;
  }
}

export function getAssetKindIcon(kind: WorkspaceArtifact["kind"]) {
  switch (kind) {
    case "table":
      return Table2;
    case "chart":
      return BarChart3;
    case "file-list":
      return Download;
    case "document":
      return FileText;
    case "dashboard":
      return LayoutDashboard;
    case "invoice":
      return Receipt;
    default:
      return FileText;
  }
}

function isImageFilename(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

export function getAssetListIcon(asset: WorkspaceArtifact) {
  if (asset.kind === "file-list") {
    const firstFile = asset.files[0];
    if (firstFile && isImageFilename(firstFile.name)) {
      return Image;
    }
    return Download;
  }

  return getAssetKindIcon(asset.kind);
}

export function formatRelativeDate(isoDate: string, options?: { includeTime?: boolean }): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) {
    return options?.includeTime === false ? "Today" : `Today ${timeLabel}`;
  }
  if (diffDays === 1) {
    return options?.includeTime === false ? "Yesterday" : `Yesterday ${timeLabel}`;
  }
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatAssetRecencyDate(asset: WorkspaceAsset): string {
  const isoDate = asset.version > 1 ? asset.updatedAt : asset.createdAt;
  return formatRelativeDate(isoDate);
}

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

export function buildAssetTitleDisambiguation(
  assets: WorkspaceAsset[]
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    const key = normalizeTitleKey(asset.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const asset of assets) {
    const key = normalizeTitleKey(asset.title);
    if ((counts.get(key) ?? 0) <= 1) continue;

    const index = (seen.get(key) ?? 0) + 1;
    seen.set(key, index);
    const isoDate = asset.version > 1 ? asset.updatedAt : asset.createdAt;
    labels.set(asset.id, formatRelativeDate(isoDate, { includeTime: true }));
  }

  return labels;
}

export function truncateFilename(title: string, maxLength = 28): string {
  if (title.length <= maxLength) return title;
  const extensionMatch = title.match(/(\.[a-z0-9]{1,8})$/i);
  const extension = extensionMatch?.[1] ?? "";
  const base = extension ? title.slice(0, -extension.length) : title;
  const remaining = Math.max(4, maxLength - extension.length - 1);
  return `${base.slice(0, remaining)}…${extension}`;
}

export function workspaceAssetToRef(asset: WorkspaceAsset): AssetRef {
  return {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    category: asset.category,
  };
}

export function formatAssetDisplayTitle(
  asset: WorkspaceAsset,
  disambiguation?: string
): string {
  const isUpload = asset.kind === "file-list";
  const baseTitle = isUpload ? truncateFilename(asset.title) : asset.title;
  if (!disambiguation) return baseTitle;
  return `${baseTitle} · ${disambiguation}`;
}
