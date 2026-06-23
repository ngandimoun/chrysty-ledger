import { Expand, FileText, LayoutDashboard, Minimize2, Receipt, Table2 } from "lucide-react";

import { ArtifactChart } from "@/components/workspace/artifact-chart";
import { ArtifactTable } from "@/components/workspace/artifact-table";
import { AssetDashboard } from "@/components/workspace/asset-dashboard";
import { AssetDocument } from "@/components/workspace/asset-document";
import { AssetInvoice } from "@/components/workspace/asset-invoice";
import { Button } from "@/components/ui/button";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";

type InlineArtifactCardProps = {
  artifact: WorkspaceArtifact;
  summary?: string;
  isExpanded?: boolean;
  suppressInlinePreview?: boolean;
  onExpand?: () => void;
  className?: string;
};

function ArtifactIcon({ kind }: { kind: WorkspaceArtifact["kind"] }) {
  if (kind === "chart") return <Table2 className="size-4 text-primary" />;
  if (kind === "file-list") return <FileText className="size-4 text-primary" />;
  if (kind === "document") return <FileText className="size-4 text-primary" />;
  if (kind === "dashboard") return <LayoutDashboard className="size-4 text-primary" />;
  if (kind === "invoice") return <Receipt className="size-4 text-primary" />;
  return <Table2 className="size-4 text-primary" />;
}

export function InlineArtifactCard({
  artifact,
  summary,
  isExpanded = false,
  suppressInlinePreview = false,
  onExpand,
  className,
}: InlineArtifactCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ArtifactIcon kind={artifact.kind} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{artifact.title}</p>
            {summary && (
              <p className="truncate text-xs text-muted-foreground">{summary}</p>
            )}
          </div>
        </div>
        {onExpand && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="shrink-0 gap-1.5 text-xs"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="size-3.5" />
                Close
              </>
            ) : (
              <>
                <Expand className="size-3.5" />
                Open
              </>
            )}
          </Button>
        )}
      </div>

      <div className="p-3">
        {isExpanded && (artifact.kind === "chart" || artifact.kind === "table") ? (
          <p className="text-xs text-muted-foreground">Opened in canvas</p>
        ) : suppressInlinePreview && (artifact.kind === "chart" || artifact.kind === "table") ? null : (
          <>
            {artifact.kind === "table" && (
              <ArtifactTable artifact={artifact} compact maxRows={5} />
            )}
            {artifact.kind === "chart" && <ArtifactChart artifact={artifact} compact />}
            {artifact.kind === "file-list" && (
              <ul className="flex flex-col gap-2">
                {artifact.files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-foreground">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{file.size}</span>
                  </li>
                ))}
              </ul>
            )}
            {artifact.kind === "document" && (
              <AssetDocument artifact={artifact} className="text-sm" />
            )}
            {artifact.kind === "dashboard" && (
              <AssetDashboard artifact={artifact} />
            )}
            {artifact.kind === "invoice" && (
              <AssetInvoice artifact={artifact} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
