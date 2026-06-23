import type { TableArtifact } from "@/lib/artifact-types";
import { DataTable } from "@/components/data-table/data-table";
import { cn } from "@/lib/utils";

type ArtifactTableProps = {
  artifact: TableArtifact;
  compact?: boolean;
  maxRows?: number;
  className?: string;
};

export function ArtifactTable({
  artifact,
  compact = false,
  maxRows,
  className,
}: ArtifactTableProps) {
  const columns = artifact.columns.map((column) => ({
    id: column,
    header: column,
    accessor: (row: Record<string, string>) => row[column] ?? "—",
  }));

  return (
    <DataTable
      columns={columns}
      rows={artifact.rows}
      compact={compact}
      maxRows={maxRows}
      className={cn(className)}
      getRowId={(_row, index) => `${artifact.id}-row-${index}`}
    />
  );
}
