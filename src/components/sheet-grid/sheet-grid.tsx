"use client";

import type { ColDef } from "ag-grid-community";
import { useCallback, useMemo } from "react";

import { AgGridShell } from "@/components/ag-grid/ag-grid-shell";
import type { TableArtifact } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";

type SheetGridProps = {
  artifact: TableArtifact;
  className?: string;
};

export function SheetGrid({ artifact, className }: SheetGridProps) {
  const columnDefs = useMemo<ColDef[]>(
    () =>
      artifact.columns.map((column) => ({
        field: column,
        headerName: column,
        editable: true,
        filter: true,
        resizable: true,
        sortable: true,
        flex: 1,
        minWidth: 100,
      })),
    [artifact.columns]
  );

  const rowData = useMemo(() => [...artifact.rows], [artifact.rows]);

  const exportCsv = useCallback(() => {
    const header = artifact.columns.join(",");
    const body = artifact.rows
      .map((row) =>
        artifact.columns.map((col) => JSON.stringify(row[col] ?? "")).join(",")
      )
      .join("\n");
    const blob = new Blob([[header, body].filter(Boolean).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${artifact.title.replace(/\s+/g, "-").toLowerCase() || "sheet"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [artifact.columns, artifact.rows, artifact.title]);

  return (
    <div className={cn("flex h-full min-h-[24rem] flex-col gap-2", className)}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          Export CSV
        </button>
      </div>
      <div className="ag-theme-quartz min-h-0 flex-1 [--ag-background-color:var(--card)] [--ag-border-color:var(--border)] [--ag-foreground-color:var(--foreground)] [--ag-header-background-color:var(--muted)]">
        <AgGridShell
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            editable: true,
            resizable: true,
            sortable: true,
            filter: true,
          }}
          enableCellTextSelection
          ensureDomOrder
          suppressMovableColumns={false}
        />
      </div>
    </div>
  );
}
