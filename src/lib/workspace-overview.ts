import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { OutcomeChip } from "@/lib/chat-types";
import type { WorkspaceAsset } from "@/lib/asset-types";

export type ActivityItem = {
  assetId: string;
  title: string;
  line: string;
  summary: string;
};

export const WORKSPACE_STARTER_SUGGESTIONS: OutcomeChip[] = [
  {
    id: "upload-receipts",
    label: "Upload receipts",
    prompt: "Here are my receipts for this month",
  },
  {
    id: "import-spreadsheet",
    label: "Import spreadsheet",
    prompt: "Import my spreadsheet",
  },
  {
    id: "create-invoice",
    label: "Create invoice",
    prompt: "Create a new invoice for a client",
  },
  {
    id: "analyze-business",
    label: "Analyze business",
    prompt: "Analyze my business finances",
  },
];

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function isAssetUpdated(asset: WorkspaceAsset): boolean {
  if (asset.version > 1) return true;
  return new Date(asset.updatedAt).getTime() > new Date(asset.createdAt).getTime();
}

function activityVerb(asset: WorkspaceAsset): "created" | "updated" | "imported" {
  if (asset.payload.kind === "file-list") {
    return isAssetUpdated(asset) ? "updated" : "imported";
  }
  return isAssetUpdated(asset) ? "updated" : "created";
}

export function summarizeAssetPayload(asset: WorkspaceAsset): string {
  const { payload } = asset;
  return summarizeArtifact(payload);
}

export function summarizeArtifact(payload: WorkspaceArtifact): string {
  switch (payload.kind) {
    case "table": {
      const rowCount = payload.rows.length;
      const colCount = payload.columns.length;
      const rowLabel = rowCount === 1 ? "row" : "rows";
      const colLabel = colCount === 1 ? "column" : "columns";
      return `${rowCount} ${rowLabel} · ${colCount} ${colLabel}`;
    }
    case "file-list": {
      const fileCount = payload.files.length;
      const label = fileCount === 1 ? "file" : "files";
      return `${fileCount} ${label} imported`;
    }
    case "dashboard": {
      const kpiCount = payload.kpis.length;
      const kpiLabel = kpiCount === 1 ? "KPI" : "KPIs";
      const parts = [`${kpiCount} ${kpiLabel}`];
      if (payload.chart) {
        parts.push("with chart");
      }
      return parts.join(" · ");
    }
    case "invoice":
      return `${payload.clientName} · ${payload.total}`;
    case "document":
      return truncate(payload.content, 80) || "Report ready";
    case "chart": {
      const pointCount = payload.data.length;
      const label = pointCount === 1 ? "data point" : "data points";
      return `${pointCount} ${label}`;
    }
    default:
      return "";
  }
}

export function formatActivityLine(asset: WorkspaceAsset): string {
  const verb = activityVerb(asset);
  return `${asset.title} ${verb}`;
}

export function buildRecentActivity(
  assets: WorkspaceAsset[],
  limit = 5
): ActivityItem[] {
  return [...assets]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit)
    .map((asset) => ({
      assetId: asset.id,
      title: asset.title,
      line: formatActivityLine(asset),
      summary: summarizeAssetPayload(asset),
    }));
}

export function buildSuggestions(assets: WorkspaceAsset[]): OutcomeChip[] {
  if (assets.length === 0) {
    return WORKSPACE_STARTER_SUGGESTIONS;
  }

  const categories = new Set(assets.map((asset) => asset.category));
  const suggestions: OutcomeChip[] = [];

  if (!categories.has("dashboard") && assets.length >= 1) {
    suggestions.push({
      id: "cashflow-forecast",
      label: "Create cashflow forecast",
      prompt: "Create a cashflow forecast dashboard from my data",
    });
  }

  if (!categories.has("report") && categories.has("sheet")) {
    suggestions.push({
      id: "tax-report",
      label: "Generate tax report",
      prompt: "Generate a tax report from my transactions",
    });
  }

  if (categories.has("sheet")) {
    suggestions.push({
      id: "analyze-expenses",
      label: "Analyze expenses",
      prompt: "Analyze my expenses by category",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "analyze-business",
      label: "Analyze business",
      prompt: "Analyze my business finances",
    });
  }

  return suggestions.slice(0, 4);
}
