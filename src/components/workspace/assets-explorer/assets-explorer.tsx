"use client";

import { AssetsExplorerPanel } from "@/components/workspace/assets-explorer/assets-explorer-panel";
import type { GroupedAssets } from "@/lib/asset-types";
import { cn } from "@/lib/utils";

type AssetsExplorerProps = {
  workspaceId: string;
  workspaceName: string;
  groupedAssets: GroupedAssets[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeAssetId?: string | null;
  onSelectAsset: (assetId: string) => void;
  className?: string;
};

/** Standalone explorer shell — prefer merged sidebar via WorkspaceSidebarContext. */
export function AssetsExplorer({
  workspaceId,
  groupedAssets,
  searchQuery,
  onSearchChange,
  activeAssetId,
  onSelectAsset,
  className,
}: AssetsExplorerProps) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r border-border bg-muted/20",
        className
      )}
    >
      <AssetsExplorerPanel
        workspaceId={workspaceId}
        groupedAssets={groupedAssets}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activeAssetId={activeAssetId}
        onSelectAsset={onSelectAsset}
      />
    </aside>
  );
}
