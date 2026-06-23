import { describe, expect, it } from "vitest";

import { createInMemoryAsset } from "@/lib/assets/service";

describe("dashboard renderer data", () => {
  it("accepts widget schema with metrics", () => {
    const asset = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "dashboard",
      title: "Overview",
      schema: {
        widgets: [
          { type: "metric", title: "Revenue", dataKey: "revenue" },
          { type: "viz", intent: "compare_categories", title: "By category" },
        ],
      },
      data: {
        metrics: { revenue: 5000 },
        series: [{ label: "Food", value: 2000 }],
      },
    });
    expect(asset.schema.widgets).toHaveLength(2);
    expect(asset.data.metrics).toEqual({ revenue: 5000 });
  });
});
