import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { Asset } from "@/lib/assets/asset";
import { createEmptyAsset } from "@/lib/assets/asset";
import type { WorkspaceAsset } from "@/lib/asset-types";
import {
  coerceTableColumns,
  normalizeTableRows,
} from "@/lib/renderers/table-utils";
import type { Tables } from "@/lib/supabase/database.types";

function inferChartIntent(chartType: string): string {
  return chartType === "pie" ? "show_distribution" : "compare_categories";
}

function formatFileSizeLabel(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function artifactToAssetV2(
  artifact: WorkspaceArtifact,
  workspaceId: string,
  extras?: Partial<Pick<Asset, "creationSequence" | "version" | "sourceMessageId" | "createdAt" | "updatedAt">>
): Asset {
  switch (artifact.kind) {
    case "table": {
      const columns = coerceTableColumns(artifact.columns);
      const rows = normalizeTableRows(
        columns,
        artifact.rows as Array<Record<string, unknown>>
      );
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "table",
        subtype: "sheet",
        title: artifact.title,
        schema: { columns },
        data: { rows },
        ...extras,
      });
    }
    case "chart":
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "chart",
        title: artifact.title,
        schema: { intent: inferChartIntent(artifact.chartType), title: artifact.title },
        data: {
          series: artifact.data.map((d) => ({ label: d.label, value: d.value })),
        },
        ...extras,
      });
    case "document":
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "document",
        subtype: "report",
        title: artifact.title,
        schema: { sections: [{ title: artifact.title, type: "text" }] },
        data: { sections: [{ title: artifact.title, body: artifact.content }] },
        ...extras,
      });
    case "dashboard":
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "dashboard",
        title: artifact.title,
        schema: {
          widgets: [
            ...artifact.kpis.map((kpi) => ({
              type: "metric" as const,
              title: kpi.label,
              dataKey: kpi.label.toLowerCase().replace(/\s+/g, "_"),
            })),
            ...(artifact.chart
              ? [
                  {
                    type: "viz" as const,
                    intent: inferChartIntent(artifact.chart.chartType) as "compare_categories",
                    title: artifact.title,
                  },
                ]
              : []),
          ],
        },
        data: {
          metrics: Object.fromEntries(artifact.kpis.map((k) => [k.label.toLowerCase().replace(/\s+/g, "_"), k.value])),
        },
        ...extras,
      });
    case "invoice":
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "document",
        subtype: "invoice",
        title: artifact.title,
        schema: {
          sections: [{ title: "Invoice", type: "text" }],
          fields: [
            { key: "invoiceNumber", label: "Invoice #" },
            { key: "clientName", label: "Client" },
            { key: "issueDate", label: "Issue date" },
            { key: "dueDate", label: "Due date" },
          ],
        },
        data: {
          sections: [
            {
              title: "Invoice",
              body: `Invoice #${artifact.invoiceNumber} for ${artifact.clientName}. Total: ${artifact.total}`,
            },
          ],
          lineItems: artifact.lineItems,
          total: artifact.total,
        },
        metadata: {
          invoiceNumber: artifact.invoiceNumber,
          clientName: artifact.clientName,
          issueDate: artifact.issueDate,
          dueDate: artifact.dueDate,
        },
        ...extras,
      });
    case "file-list":
      return createEmptyAsset({
        id: artifact.id,
        workspaceId,
        kind: "file",
        subtype: "bundle",
        title: artifact.title,
        schema: { filename: artifact.title },
        data: {
          storageRef: `legacy-file-list:${artifact.id}`,
          files: artifact.files,
        },
        ...extras,
      });
    default: {
      const unknown = artifact as { id: string; title: string };
      return createEmptyAsset({
        id: unknown.id,
        workspaceId,
        kind: "document",
        title: unknown.title,
        schema: { sections: [{ title: unknown.title, type: "text" }] },
        data: { sections: [{ title: unknown.title, body: "" }] },
        ...extras,
      });
    }
  }
}

export function workspaceAssetToAssetV2(asset: WorkspaceAsset): Asset {
  return artifactToAssetV2(asset.payload, asset.workspaceId, {
    creationSequence: asset.creationSequence,
    version: asset.version,
    sourceMessageId: asset.sourceMessageId,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });
}

export function assetV2ToWorkspaceAsset(asset: Asset): WorkspaceAsset {
  const legacy = assetV2ToArtifact(asset);
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    title: asset.title,
    category: inferLegacyCategory(asset),
    kind: legacy.kind,
    payload: legacy,
    sourceMessageId: asset.sourceMessageId,
    creationSequence: asset.creationSequence,
    version: asset.version,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function inferLegacyCategory(asset: Asset): WorkspaceAsset["category"] {
  if (asset.kind === "table") return "sheet";
  if (asset.kind === "dashboard") return "dashboard";
  if (asset.kind === "chart") return "chart";
  if (asset.subtype === "invoice") return "invoice";
  if (asset.kind === "document") return "report";
  if (asset.kind === "file") return "files";
  return "sheet";
}

function hasLegacyPayload(payload: unknown): payload is WorkspaceArtifact {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  return "kind" in payload && typeof (payload as { kind?: unknown }).kind === "string";
}

export function ledgerAssetRowToAsset(row: Tables<"ledger_assets">): Asset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    kind: row.kind,
    subtype: row.subtype,
    title: row.title,
    schema: (row.asset_schema as Record<string, unknown>) ?? {},
    data: (row.asset_data as Record<string, unknown>) ?? {},
    relations: (row.relations as Asset["relations"]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    version: row.version,
    creationSequence: row.creation_sequence,
    sourceMessageId: row.source_message_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function hasV2TableSchema(row: Tables<"ledger_assets">): boolean {
  if (row.kind !== "table") return false;
  const columns = (row.asset_schema as { columns?: unknown } | null)?.columns;
  if (!Array.isArray(columns) || columns.length === 0) return false;
  return columns.every(
    (column) =>
      column &&
      typeof column === "object" &&
      typeof (column as { key?: unknown }).key === "string" &&
      (column as { key: string }).key.length > 0
  );
}

export function ledgerRowToWorkspaceAsset(row: Tables<"ledger_assets">): WorkspaceAsset {
  if (row.kind === "file" || !hasLegacyPayload(row.payload) || hasV2TableSchema(row)) {
    return assetV2ToWorkspaceAsset(ledgerAssetRowToAsset(row));
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    category: row.category as WorkspaceAsset["category"],
    kind: row.kind as WorkspaceAsset["kind"],
    payload: row.payload,
    sourceMessageId: row.source_message_id ?? undefined,
    creationSequence: row.creation_sequence,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function assetV2ToArtifact(asset: Asset): WorkspaceArtifact {
  switch (asset.kind) {
    case "table": {
      const columns = ((asset.schema.columns as { key: string; label: string }[]) ?? []).map(
        (c) => c.label || c.key
      );
      const rows = ((asset.data.rows as Record<string, string>[]) ?? []).map((row) => {
        const out: Record<string, string> = {};
        for (const col of (asset.schema.columns as { key: string; label: string }[]) ?? []) {
          out[col.label || col.key] = String(row[col.key] ?? "");
        }
        return out;
      });
      return { id: asset.id, kind: "table", title: asset.title, columns, rows };
    }
    case "chart": {
      const series = (asset.data.series as { label: string; value: number }[]) ?? [];
      const intent = String(asset.schema.intent ?? "compare_categories");
      return {
        id: asset.id,
        kind: "chart",
        title: asset.title,
        chartType: intent.includes("distribution") || intent.includes("whole") ? "pie" : "bar",
        data: series.map((s) => ({ label: s.label, value: s.value })),
      };
    }
    case "dashboard": {
      const metrics = (asset.data.metrics as Record<string, string>) ?? {};
      return {
        id: asset.id,
        kind: "dashboard",
        title: asset.title,
        kpis: Object.entries(metrics).map(([label, value]) => ({
          label,
          value: String(value),
        })),
      };
    }
    case "document": {
      if (asset.subtype === "invoice") {
        const meta = asset.metadata;
        const lineItems =
          (asset.data.lineItems as Array<{
            description: string;
            quantity: number;
            rate: string;
            amount: string;
          }>) ?? [];
        return {
          id: asset.id,
          kind: "invoice",
          title: asset.title,
          invoiceNumber: String(meta.invoiceNumber ?? ""),
          clientName: String(meta.clientName ?? ""),
          issueDate: String(meta.issueDate ?? ""),
          dueDate: String(meta.dueDate ?? ""),
          lineItems,
          total: String(asset.data.total ?? ""),
        };
      }
      const sections = (asset.data.sections as { title: string; body: string }[]) ?? [];
      return {
        id: asset.id,
        kind: "document",
        title: asset.title,
        content: sections.map((s) => s.body).join("\n\n"),
      };
    }
    case "file": {
      const bundleFiles = (asset.data.files as { name: string; size: string }[]) ?? [];
      if (bundleFiles.length > 0) {
        return {
          id: asset.id,
          kind: "file-list",
          title: asset.title,
          files: bundleFiles,
        };
      }

      const filename = String(asset.schema.filename ?? asset.title);
      const sizeBytes = typeof asset.data.size === "number" ? asset.data.size : 0;
      return {
        id: asset.id,
        kind: "file-list",
        title: asset.title,
        files: [{ name: filename, size: formatFileSizeLabel(sizeBytes) }],
      };
    }
    default: {
      const sections = (asset.data.sections as { body: string }[]) ?? [];
      return {
        id: asset.id,
        kind: "document",
        title: asset.title,
        content: sections.map((s) => s.body).join("\n\n"),
      };
    }
  }
}
