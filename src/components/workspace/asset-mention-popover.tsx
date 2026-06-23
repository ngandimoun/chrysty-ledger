"use client";

import type { WorkspaceAsset } from "@/lib/asset-types";
import { getAssetListIcon } from "@/components/workspace/assets-explorer/asset-utils";
import { cn } from "@/lib/utils";

type AssetMentionPopoverProps = {
  assets: WorkspaceAsset[];
  query: string;
  selectedIndex: number;
  onSelect: (asset: WorkspaceAsset) => void;
  className?: string;
};

export function AssetMentionPopover({
  assets,
  query,
  selectedIndex,
  onSelect,
  className,
}: AssetMentionPopoverProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    if (!normalizedQuery) return true;
    return (
      asset.title.toLowerCase().includes(normalizedQuery) ||
      asset.kind.toLowerCase().includes(normalizedQuery) ||
      asset.category.toLowerCase().includes(normalizedQuery)
    );
  });

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          "absolute bottom-full left-0 z-50 mb-2 w-full max-h-48 overflow-y-auto rounded-xl border border-[#444444] bg-[#1F2023] p-2 shadow-xl",
          className
        )}
      >
        <p className="px-2 py-2 text-xs text-[#9CA3AF]">No matching assets</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 z-50 mb-2 w-full max-h-48 overflow-y-auto rounded-xl border border-[#444444] bg-[#1F2023] p-1 shadow-xl",
        className
      )}
    >
      {filtered.slice(0, 8).map((asset, index) => {
        const Icon = getAssetListIcon(asset.payload);
        return (
          <button
            key={asset.id}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(asset);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              index === selectedIndex
                ? "bg-[#9b87f5]/20 text-white"
                : "text-[#D1D5DB] hover:bg-[#2E3033]"
            )}
          >
            <Icon className="size-4 shrink-0 text-[#9CA3AF]" />
            <span className="min-w-0 flex-1 truncate">{asset.title}</span>
            <span className="shrink-0 text-[10px] uppercase text-[#9CA3AF]">{asset.kind}</span>
          </button>
        );
      })}
    </div>
  );
}
