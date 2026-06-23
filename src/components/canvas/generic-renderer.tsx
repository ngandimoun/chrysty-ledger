"use client";

import type { Asset } from "@/lib/assets/asset";
import { cn } from "@/lib/utils";

type GenericRendererProps = {
  asset: Asset;
  className?: string;
};

export function GenericRenderer({ asset, className }: GenericRendererProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-4", className)}>
      <p className="text-sm font-medium text-foreground">{asset.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Kind: {asset.kind}
        {asset.subtype ? ` / ${asset.subtype}` : ""}
      </p>
      <pre className="mt-4 max-h-96 overflow-auto rounded bg-background p-3 text-xs text-muted-foreground">
        {JSON.stringify({ schema: asset.schema, data: asset.data }, null, 2)}
      </pre>
    </div>
  );
}
