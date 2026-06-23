import { describe, expect, it } from "vitest";

import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import { resolveAssetForOpen } from "@/lib/workspace-assets";

const workspaceId = "ws-1";

function makeChartArtifact(
  overrides: Partial<WorkspaceArtifact> & Pick<WorkspaceArtifact, "id" | "title">
): WorkspaceArtifact {
  return {
    id: overrides.id,
    kind: "chart",
    title: overrides.title,
    chartType: "bar",
    xKey: "category",
    yKeys: ["total"],
    data: [{ category: "Food", total: 100 }],
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkspaceArtifact;
}

function makeAsset(
  overrides: Partial<WorkspaceAsset> & Pick<WorkspaceAsset, "id" | "title">
): WorkspaceAsset {
  const artifact = makeChartArtifact({ id: overrides.id, title: overrides.title });
  return {
    workspaceId,
    category: "chart",
    kind: "chart",
    payload: artifact,
    sourceMessageId: undefined,
    creationSequence: 1,
    version: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveAssetForOpen", () => {
  it("opens by exact id in full assets list", () => {
    const assets = [makeAsset({ id: "asset-1", title: "Spending by category" })];
    const resolved = resolveAssetForOpen({
      assetId: "asset-1",
      workspaceId,
      assets,
      displayAssets: assets,
    });

    expect(resolved?.id).toBe("asset-1");
  });

  it("maps duplicate message id to canonical deduped id by title and kind", () => {
    const canonical = makeAsset({ id: "canonical-id", title: "Spending by category", version: 3 });
    const displayAssets = [canonical];
    const assets = [canonical];

    const artifact = makeChartArtifact({ id: "message-id", title: "Spending by category" });
    const resolved = resolveAssetForOpen({
      assetId: "message-id",
      workspaceId,
      assets,
      displayAssets,
      artifact,
    });

    expect(resolved?.id).toBe("canonical-id");
  });

  it("synthesizes from artifact when not in cache", () => {
    const artifact = makeChartArtifact({ id: "orphan-id", title: "New chart" });
    const resolved = resolveAssetForOpen({
      assetId: "orphan-id",
      workspaceId,
      assets: [],
      displayAssets: [],
      artifact,
    });

    expect(resolved?.id).toBe("orphan-id");
    expect(resolved?.workspaceId).toBe(workspaceId);
    expect(resolved?.payload).toEqual(artifact);
  });
});
