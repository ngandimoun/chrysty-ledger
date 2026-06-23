import { describe, expect, it } from "vitest";

import { colorForIndex, formatChartValue } from "@/lib/viz/chart-colors";
import { aggregateSeriesByLabel, isVizIntent, resolveVizSpec } from "@/lib/viz/viz-engine";

const INTENTS = [
  "show_over_time",
  "show_revenue_over_time",
  "compare_categories",
  "show_distribution",
  "show_part_of_whole",
  "compare_metrics",
] as const;

describe("VizEngine", () => {
  it.each(INTENTS)("maps intent %s to a chart type", (intent) => {
    const spec = resolveVizSpec({
      intent,
      series: [{ label: "A", value: 10 }],
    });
    expect(spec.chartType).toBeTruthy();
    expect(spec.empty).toBe(false);
  });

  it("returns empty state for missing data without throwing", () => {
    const spec = resolveVizSpec({ intent: "compare_categories", series: [] });
    expect(spec.empty).toBe(true);
    expect(spec.data).toEqual([]);
  });

  it("falls back unknown intents to bar chart", () => {
    const spec = resolveVizSpec({
      intent: "unknown_intent",
      series: [{ label: "X", value: 1 }],
    });
    expect(spec.chartType).toBe("bar");
  });

  it("uses colorful bar for spending category breakdowns", () => {
    const spec = resolveVizSpec({
      intent: "compare_categories",
      subtype: "spending",
      title: "Spending by category",
      series: [{ label: "Food", value: 100 }],
    });
    expect(spec.chartType).toBe("bar");
  });

  it("uses colorful bar when title mentions by category", () => {
    const spec = resolveVizSpec({
      intent: "compare_categories",
      title: "Rohit Sharma spending by category",
      series: [{ label: "Food", value: 100 }],
    });
    expect(spec.chartType).toBe("bar");
  });

  it("maps show_part_of_whole to bar chart", () => {
    const spec = resolveVizSpec({
      intent: "show_part_of_whole",
      series: [{ label: "Food", value: 100 }],
    });
    expect(spec.chartType).toBe("bar");
  });

  it("auto-picks line for daily subtype", () => {
    const spec = resolveVizSpec({
      intent: "compare_categories",
      subtype: "daily",
      title: "Daily spending",
      series: [{ label: "2024-01-01", value: 100 }],
    });
    expect(spec.chartType).toBe("line");
  });

  it("auto-picks line for show_over_time intent", () => {
    const spec = resolveVizSpec({
      intent: "show_over_time",
      title: "Daily spending",
      series: [{ label: "Day 1", value: 100 }],
    });
    expect(spec.chartType).toBe("line");
  });

  it("identifies known intents", () => {
    expect(isVizIntent("show_over_time")).toBe(true);
    expect(isVizIntent("not_real")).toBe(false);
  });
});

describe("aggregateSeriesByLabel", () => {
  it("sums duplicate labels and preserves first-seen order", () => {
    const aggregated = aggregateSeriesByLabel([
      { label: "18/05/2024", value: 100 },
      { label: "19/05/2024", value: 50 },
      { label: "18/05/2024", value: 75 },
      { label: "19/05/2024", value: 25 },
    ]);

    expect(aggregated).toEqual([
      { label: "18/05/2024", value: 175 },
      { label: "19/05/2024", value: 75 },
    ]);
  });
});

describe("chart-colors", () => {
  it("cycles colors by index", () => {
    expect(colorForIndex(0)).toBe("var(--chart-1)");
    expect(colorForIndex(5)).toBe("var(--chart-1)");
  });

  it("formats currency when title includes rupee hint", () => {
    expect(formatChartValue(1200, { title: "Total (₹)" })).toBe("₹1,200");
  });

  it("formats plain numbers without currency hints", () => {
    expect(formatChartValue(1200, { title: "Count by region" })).toBe("1,200");
  });
});
