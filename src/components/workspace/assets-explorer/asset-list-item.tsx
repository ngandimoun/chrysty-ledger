import type { WorkspaceAsset } from "@/lib/asset-types";
import {
  formatAssetDisplayTitle,
  formatAssetRecencyDate,
  getAssetListIcon,
} from "@/components/workspace/assets-explorer/asset-utils";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

type AssetListItemProps = {
  asset: WorkspaceAsset;
  isActive?: boolean;
  titleDisambiguation?: string;
  onSelect: (assetId: string) => void;
  onAddToChat?: (asset: WorkspaceAsset) => void;
};

export function AssetListItem({
  asset,
  isActive = false,
  titleDisambiguation,
  onSelect,
  onAddToChat,
}: AssetListItemProps) {
  const Icon = getAssetListIcon(asset.payload);
  const displayTitle = formatAssetDisplayTitle(asset, titleDisambiguation);

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-1 rounded-lg transition-colors",
        isActive ? "bg-primary/12" : "hover:bg-muted/80"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(asset.id)}
        title={asset.title}
        className={cn(
          "flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
          isActive ? "text-primary" : "text-foreground"
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{displayTitle}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatAssetRecencyDate(asset)}
          {asset.version > 1 ? ` · v${asset.version}` : ""}
        </span>
      </button>
      {onAddToChat && (
        <button
          type="button"
          title="Add to chat"
          aria-label={`Add ${asset.title} to chat`}
          onClick={(event) => {
            event.stopPropagation();
            onAddToChat(asset);
          }}
          className={cn(
            "mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100"
          )}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
