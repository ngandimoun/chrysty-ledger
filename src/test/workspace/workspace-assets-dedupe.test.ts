import { describe, expect, it } from "vitest";

import { dedupeAssetsByTitleAndKind } from "@/lib/workspace-assets";
import type { WorkspaceAsset } from "@/lib/asset-types";

function makeAsset(overrides: Partial<WorkspaceAsset> & Pick<WorkspaceAsset, "id" | "title">): WorkspaceAsset {
  return {
    workspaceId: "ws-1",
    category: "sheet",
    kind: "table",
    payload: {
      id: overrides.id,
      kind: "table",
      title: overrides.title,
      columns: [],
      rows: [],
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    sourceMessageId: undefined,
    creationSequence: 1,
    version: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dedupeAssetsByTitleAndKind", () => {
  it("keeps the highest version for matching title and kind", () => {
    const deduped = dedupeAssetsByTitleAndKind([
      makeAsset({ id: "a-old", title: "Spending by category", kind: "chart", version: 1 }),
      makeAsset({
        id: "a-new",
        title: "Spending by category",
        kind: "chart",
        version: 3,
        updatedAt: "2024-01-02T00:00:00.000Z",
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("a-new");
  });
});
