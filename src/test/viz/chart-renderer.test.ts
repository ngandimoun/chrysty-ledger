import { describe, expect, it } from "vitest";

import { resolveVizSpec } from "@/lib/viz/viz-engine";

describe("ChartRenderer viz resolution", () => {
  it("resolves spending category assets to colorful bar for canvas display", () => {
    const spec = resolveVizSpec({
      intent: "compare_categories",
      subtype: "spending",
      title: "Spending by category",
      series: [
        { label: "Room Rent", value: 1800 },
        { label: "Food", value: 550 },
      ],
    });

    expect(spec.chartType).toBe("bar");
    expect(spec.data).toHaveLength(2);
  });

  it("resolves daily spending assets to line charts", () => {
    const spec = resolveVizSpec({
      intent: "show_over_time",
      subtype: "daily",
      title: "Daily spending",
      series: [
        { label: "Day 1", value: 500 },
        { label: "Day 2", value: 300 },
      ],
    });

    expect(spec.chartType).toBe("line");
  });

  it("keeps generic compare_categories as colorful bar fallback", () => {
    const spec = resolveVizSpec({
      intent: "compare_categories",
      title: "Vendor comparison",
      series: [{ label: "A", value: 10 }],
    });

    expect(spec.chartType).toBe("bar");
  });
});
