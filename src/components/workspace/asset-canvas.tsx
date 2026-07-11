"use client";

import { ChrystyHostContext } from "@chrysty/live-embed";
import { X } from "lucide-react";

import { RenderAsset } from "@/lib/renderers/registry";
import { workspaceAssetToAssetV2 } from "@/lib/assets/adapters/legacy";
import { Button } from "@/components/ui/button";
import type { WorkspaceAsset } from "@/lib/asset-types";
import { cn } from "@/lib/utils";

type AssetCanvasProps = {
  asset: WorkspaceAsset;
  onClose?: () => void;
  className?: string;
};

export function AssetCanvas({ asset, onClose, className }: AssetCanvasProps) {
  const assetV2 = workspaceAssetToAssetV2(asset);

  return (
    <ChrystyHostContext
      source="ledger_asset"
      entityId={asset.id}
      title={asset.title}
      captureTarget="#asset-content"
      worker="ledger"
    >
      <div
        id="asset-content"
        data-chrysty-capture
        className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {asset.title}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {assetV2.kind}
              {assetV2.subtype ? ` · ${assetV2.subtype}` : ""}
            </p>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close asset"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <RenderAsset asset={assetV2} className="min-w-0 w-full" />
        </div>
      </div>
    </ChrystyHostContext>
  );
}
