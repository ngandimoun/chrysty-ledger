"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T) => string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  compact?: boolean;
  maxRows?: number;
  className?: string;
  getRowId?: (row: T, index: number) => string;
};

export function DataTable<T>({
  columns,
  rows,
  compact = false,
  maxRows,
  className,
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;
  const hasMore = maxRows ? rows.length > maxRows : false;

  const columnDefs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        accessorFn: (row) => column.accessor(row),
        header: column.header,
        cell: (info) => info.getValue() ?? "—",
      })),
    [columns]
  );

  const table = useReactTable({
    data: displayRows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId ?? ((_row, index) => String(index)),
  });

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "cursor-pointer font-medium text-muted-foreground select-none",
                      compact ? "px-2 py-1.5 text-xs" : "px-3 py-2"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "text-foreground",
                      compact ? "px-2 py-1.5 text-xs" : "px-3 py-2"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          +{rows.length - (maxRows ?? 0)} more rows
        </p>
      )}
    </div>
  );
}
