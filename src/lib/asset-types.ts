import type { WorkspaceArtifact } from "@/lib/artifact-types";

export type AssetCategory =
  | "sheet"
  | "dashboard"
  | "report"
  | "invoice"
  | "export"
  | "files"
  | "chart";

export const ASSET_CATEGORY_ORDER: AssetCategory[] = [
  "sheet",
  "dashboard",
  "chart",
  "report",
  "invoice",
  "files",
  "export",
];

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  sheet: "Sheets",
  dashboard: "Dashboards",
  chart: "Charts",
  report: "Reports",
  invoice: "Invoices",
  files: "Uploads",
  export: "Exports",
};

export type WorkspaceAsset = {
  id: string;
  workspaceId: string;
  title: string;
  category: AssetCategory;
  kind: WorkspaceArtifact["kind"];
  payload: WorkspaceArtifact;
  sourceMessageId?: string;
  creationSequence: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type GroupedAssets = {
  category: AssetCategory;
  label: string;
  assets: WorkspaceAsset[];
};
