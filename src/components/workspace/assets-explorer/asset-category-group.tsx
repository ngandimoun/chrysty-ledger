"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

import { AssetListItem } from "@/components/workspace/assets-explorer/asset-list-item";
import { buildAssetTitleDisambiguation } from "@/components/workspace/assets-explorer/asset-utils";
import type { GroupedAssets, WorkspaceAsset } from "@/lib/asset-types";
import { cn } from "@/lib/utils";

type AssetCategoryGroupProps = {
  group: GroupedAssets;
  isCollapsed: boolean;
  activeAssetId?: string | null;
  onToggle: () => void;
  onSelectAsset: (assetId: string) => void;
  onAddToChat?: (asset: WorkspaceAsset) => void;
};

export function AssetCategoryGroup({
  group,
  isCollapsed,
  activeAssetId,
  onToggle,
  onSelectAsset,
  onAddToChat,
}: AssetCategoryGroupProps) {
  const titleDisambiguation = useMemo(
    () => buildAssetTitleDisambiguation(group.assets),
    [group.assets]
  );

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-muted/50"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isCollapsed && "-rotate-90"
          )}
        />
        <span className="truncate">
          {group.label} ({group.assets.length})
        </span>
      </button>

      {!isCollapsed && (
        <div className="flex flex-col gap-0.5 pb-1 pl-1">
          {group.assets.map((asset) => (
            <AssetListItem
              key={asset.id}
              asset={asset}
              isActive={activeAssetId === asset.id}
              titleDisambiguation={titleDisambiguation.get(asset.id)}
              onSelect={onSelectAsset}
              onAddToChat={onAddToChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
