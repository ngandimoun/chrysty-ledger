import { describe, expect, it } from "vitest";

import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";
import { mergeAssetDefinitionForUpdate } from "@/lib/assets/asset-merge";

const baseAsset: Asset = {
  id: "asset-1",
  workspaceId: "ws-1",
  projectId: null,
  kind: "table",
  subtype: "sheet",
  title: "Spending by category",
  schema: {
    columns: [
      { key: "category", label: "Category", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
  },
  data: {
    rows: [
      { category: "Room Rent", amount: 1800 },
      { category: "Food", amount: 550 },
    ],
  },
  relations: [],
  metadata: {},
  version: 1,
  creationSequence: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  archivedAt: null,
};

describe("mergeAssetDefinitionForUpdate", () => {
  it("appends new table rows and updates matching labels", () => {
    const incoming: AssetDefinitionInput = {
      workspaceId: "ws-1",
      kind: "table",
      subtype: "sheet",
      title: "New table",
      schema: baseAsset.schema,
      data: {
        rows: [
          { category: "Food", amount: 600 },
          { category: "Transport", amount: 350 },
        ],
      },
    };

    const merged = mergeAssetDefinitionForUpdate(baseAsset, incoming);
    const rows = merged.data?.rows as Array<Record<string, number | string>>;

    expect(merged.title).toBe("Spending by category");
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.category === "Food")?.amount).toBe(600);
    expect(rows.find((row) => row.category === "Transport")?.amount).toBe(350);
  });

  it("normalizes legacy column keys when merging", () => {
    const legacyAsset: Asset = {
      ...baseAsset,
      data: {
        rows: [{ Category: "Room Rent", "Total (₹)": 1800 }],
      },
    };

    const incoming: AssetDefinitionInput = {
      workspaceId: "ws-1",
      kind: "table",
      subtype: "sheet",
      title: "New table",
      schema: baseAsset.schema,
      data: {
        rows: [{ category: "Entertainment", amount: 200 }],
      },
    };

    const merged = mergeAssetDefinitionForUpdate(legacyAsset, incoming);
    const rows = merged.data?.rows as Array<Record<string, number | string>>;

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !Object.values(row).every((value) => String(value).trim() === ""))).toBe(
      true
    );
  });

  it("merges chart series by label", () => {
    const chartAsset: Asset = {
      ...baseAsset,
      kind: "chart",
      title: "Spending by category",
      schema: { intent: "compare_categories", title: "Spending by category" },
      data: {
        series: [
          { label: "Room Rent", value: 1800 },
          { label: "Food", value: 550 },
        ],
      },
    };

    const incoming: AssetDefinitionInput = {
      workspaceId: "ws-1",
      kind: "chart",
      title: "Updated chart",
      schema: chartAsset.schema,
      data: {
        series: [
          { label: "Food", value: 600 },
          { label: "Transport", value: 350 },
        ],
      },
    };

    const merged = mergeAssetDefinitionForUpdate(chartAsset, incoming);
    const series = merged.data?.series as Array<{ label: string; value: number }>;

    expect(series).toHaveLength(3);
    expect(series.find((point) => point.label === "Food")?.value).toBe(600);
    expect(series.find((point) => point.label === "Transport")?.value).toBe(350);
  });
});
