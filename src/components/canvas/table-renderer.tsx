"use client";

import { useMemo } from "react";

import { AgGridShell } from "@/components/ag-grid/ag-grid-shell";
import { buildColumnDefs, coerceTableColumns, normalizeTableRows } from "@/lib/renderers/table-utils";
import type { Asset } from "@/lib/assets/asset";
import { cn } from "@/lib/utils";

type TableRendererProps = {
  asset: Asset;
  className?: string;
};

export function TableRenderer({ asset, className }: TableRendererProps) {
  const columns = coerceTableColumns(asset.schema.columns);
  const rows = (asset.data.rows as Array<Record<string, unknown>>) ?? [];

  const columnDefs = useMemo(() => buildColumnDefs(columns), [columns]);
  const rowData = useMemo(() => normalizeTableRows(columns, rows), [columns, rows]);

  if (!columns.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No columns defined for this table.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ag-theme-quartz h-full min-h-[24rem] w-full [--ag-background-color:var(--card)] [--ag-border-color:var(--border)] [--ag-foreground-color:var(--foreground)] [--ag-header-background-color:var(--muted)]",
        className
      )}
    >
      {rowData.length === 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">No rows yet — add data to populate this sheet.</p>
      ) : null}
      <AgGridShell columnDefs={columnDefs} rowData={rowData} domLayout="autoHeight" />
    </div>
  );
}
