import type { AssetEvent } from "@/lib/asset-event-types";

export function getAssetRevisionHistory(
  events: AssetEvent[],
  assetId: string
): AssetEvent[] {
  return events
    .filter(
      (event) =>
        event.assetId === assetId &&
        (event.type === "asset_created" || event.type === "asset_updated")
    )
    .sort((a, b) => a.sequence - b.sequence);
}
