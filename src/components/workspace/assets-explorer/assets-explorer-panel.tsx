"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { AssetCategoryGroup } from "@/components/workspace/assets-explorer/asset-category-group";
import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { Input } from "@/components/ui/input";
import {
  getWorkspaceSettings,
  updateCollapsedCategories,
} from "@/lib/ledger/workspaces";
import type { AssetCategory, GroupedAssets, WorkspaceAsset } from "@/lib/asset-types";
import { cn } from "@/lib/utils";

type AssetsExplorerPanelProps = {
  workspaceId: string;
  groupedAssets: GroupedAssets[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeAssetId?: string | null;
  onSelectAsset: (assetId: string) => void;
  onAssetSelect?: () => void;
  onAddToChat?: (asset: WorkspaceAsset) => void;
  className?: string;
};

export function AssetsExplorerPanel({
  workspaceId,
  groupedAssets,
  searchQuery,
  onSearchChange,
  activeAssetId,
  onSelectAsset,
  onAssetSelect,
  onAddToChat,
  className,
}: AssetsExplorerPanelProps) {
  const scope = useOptionalLedgerScope();
  const [collapsed, setCollapsed] = useState<Set<AssetCategory>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!scope) return;
    const activeScope = scope;

    let cancelled = false;

    async function load() {
      try {
        const settings = await getWorkspaceSettings(activeScope, workspaceId);
        if (!cancelled) {
          setCollapsed(new Set(settings.collapsedCategories ?? []));
          setIsHydrated(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load explorer settings"
          );
          setIsHydrated(true);
        }
      }
    }

    setIsHydrated(false);
    void load();

    return () => {
      cancelled = true;
    };
  }, [scope, workspaceId]);

  useEffect(() => {
    if (!scope || !isHydrated) return;
    const activeScope = scope;

    void updateCollapsedCategories(activeScope, workspaceId, [...collapsed]).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save explorer settings");
    });
  }, [scope, workspaceId, collapsed, isHydrated]);

  const toggleCategory = useCallback((category: AssetCategory) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleSelectAsset = useCallback(
    (assetId: string) => {
      onSelectAsset(assetId);
      onAssetSelect?.();
    },
    [onSelectAsset, onAssetSelect]
  );

  const totalAssets = groupedAssets.reduce((sum, group) => sum + group.assets.length, 0);
  const isEmpty = totalAssets === 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="shrink-0 px-2 py-2 sm:px-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search..."
            className="h-8 bg-background pl-8 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1 sm:px-2">
        {isEmpty ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">No assets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask Chrysty to create one
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groupedAssets.map((group) => (
              <AssetCategoryGroup
                key={group.category}
                group={group}
                isCollapsed={collapsed.has(group.category)}
                activeAssetId={activeAssetId}
                onToggle={() => toggleCategory(group.category)}
                onSelectAsset={handleSelectAsset}
                onAddToChat={onAddToChat}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
