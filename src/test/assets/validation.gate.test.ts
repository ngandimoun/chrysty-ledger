import { describe, expect, it } from "vitest";

import { validateAndNormalizeAsset } from "@/lib/assets/validation/gate";

describe("AssetValidationGate", () => {
  it("rejects table with empty columns", () => {
    const result = validateAndNormalizeAsset({
      workspaceId: "ws-1",
      kind: "table",
      title: "Bad table",
      schema: { columns: [] },
      data: { rows: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/column/i);
      expect(result.hints.length).toBeGreaterThan(0);
    }
  });

  it("rejects chart with null series shape", () => {
    const result = validateAndNormalizeAsset({
      workspaceId: "ws-1",
      kind: "chart",
      title: "Bad chart",
      schema: {},
      data: { series: null as unknown as [] },
    });
    expect(result.ok).toBe(false);
  });

  it("normalizes table rows with missing keys", () => {
    const result = validateAndNormalizeAsset({
      workspaceId: "ws-1",
      kind: "table",
      title: "Inventory",
      schema: {
        columns: [{ key: "item", label: "Item", type: "text" }],
      },
      data: {
        rows: [{ item: "Flour" }, { other: "ignored" } as Record<string, string>],
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.data.rows).toEqual([{ item: "Flour" }, { item: "" }]);
    }
  });

  it("accepts valid dashboard", () => {
    const result = validateAndNormalizeAsset({
      workspaceId: "ws-1",
      kind: "dashboard",
      title: "Cashflow",
      schema: {
        widgets: [{ type: "metric", title: "Revenue", dataKey: "revenue" }],
      },
      data: { metrics: { revenue: 1000 } },
    });
    expect(result.ok).toBe(true);
  });
});
