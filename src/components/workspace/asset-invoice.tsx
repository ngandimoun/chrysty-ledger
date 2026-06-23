import type { InvoiceArtifact } from "@/lib/artifact-types";
import { DataTable } from "@/components/data-table/data-table";
import { cn } from "@/lib/utils";

type AssetInvoiceProps = {
  artifact: InvoiceArtifact;
  className?: string;
};

export function AssetInvoice({ artifact, className }: AssetInvoiceProps) {
  const columns = [
    {
      id: "description",
      header: "Description",
      accessor: (row: InvoiceArtifact["lineItems"][number]) => row.description,
    },
    {
      id: "quantity",
      header: "Qty",
      accessor: (row: InvoiceArtifact["lineItems"][number]) => String(row.quantity),
    },
    {
      id: "rate",
      header: "Rate",
      accessor: (row: InvoiceArtifact["lineItems"][number]) => row.rate,
    },
    {
      id: "amount",
      header: "Amount",
      accessor: (row: InvoiceArtifact["lineItems"][number]) => row.amount,
    },
  ];

  return (
    <div className={cn("mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{artifact.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Invoice #{artifact.invoiceNumber}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Issued: {artifact.issueDate}</p>
          <p>Due: {artifact.dueDate}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Bill to</p>
        <p className="mt-1 text-sm font-medium text-foreground">{artifact.clientName}</p>
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={artifact.lineItems}
          getRowId={(row) => `${row.description}-${row.amount}`}
        />
      </div>

      <div className="mt-4 flex justify-end border-t border-border pt-4">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold text-foreground">{artifact.total}</p>
        </div>
      </div>
    </div>
  );
}
