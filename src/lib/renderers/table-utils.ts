import type { ColDef } from "ag-grid-community";

import { sanitizeTableCellValue } from "@/lib/ai/orchestrator/chat-analysis-assets";
import type { TableColumn } from "@/lib/assets/schemas/kinds";

function labelToKey(label: string, index: number): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return key || `col_${index}`;
}

function coerceColumnType(value: unknown): TableColumn["type"] {
  if (value === "number" || value === "currency" || value === "date") return value;
  return "text";
}

/** Normalize legacy string columns and partial schema objects for AG Grid. */
export function coerceTableColumns(raw: unknown): TableColumn[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index): TableColumn | null => {
      if (typeof item === "string" && item.trim()) {
        const label = item.trim();
        return { key: label, label, type: "text" };
      }
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const label =
        (typeof record.label === "string" && record.label.trim()) ||
        (typeof record.headerName === "string" && record.headerName.trim()) ||
        (typeof record.key === "string" && record.key.trim()) ||
        (typeof record.field === "string" && record.field.trim()) ||
        `Column ${index + 1}`;
      const key =
        (typeof record.key === "string" && record.key.trim()) ||
        (typeof record.field === "string" && record.field.trim()) ||
        labelToKey(label, index);

      if (!key) return null;

      return {
        key,
        label,
        type: coerceColumnType(record.type),
      };
    })
    .filter((column): column is TableColumn => Boolean(column?.key));
}

export function buildColumnDefs(columns: TableColumn[]): ColDef[] {
  if (!columns.length) return [];
  return columns.map((column) => ({
    field: column.key,
    headerName: column.label || column.key,
    editable: true,
    filter: true,
    resizable: true,
    sortable: true,
    flex: 1,
    minWidth: 100,
    ...(column.type === "number" || column.type === "currency"
      ? { type: "numericColumn" as const }
      : {}),
  }));
}

export function normalizeTableRows(
  columns: TableColumn[],
  rows: Array<Record<string, unknown>>
): Array<Record<string, string | number | null>> {
  const keys = columns.map((c) => c.key);
  return rows.map((row) => {
    const normalized: Record<string, string | number | null> = {};
    for (const key of keys) {
      const value = row[key];
      if (value === undefined || value === null) {
        normalized[key] = "";
      } else if (typeof value === "number") {
        normalized[key] = value;
      } else {
        normalized[key] = sanitizeTableCellValue(String(value));
      }
    }
    return normalized;
  });
}
