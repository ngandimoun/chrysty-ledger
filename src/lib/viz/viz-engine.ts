export type VizChartType = "line" | "bar" | "pie" | "donut" | "grouped_bar";

export type VizSpec = {
  chartType: VizChartType;
  title?: string;
  data: Array<{ label: string; value: number }>;
  empty: boolean;
};

export type VizIntent =
  | "show_over_time"
  | "show_revenue_over_time"
  | "compare_categories"
  | "show_distribution"
  | "show_part_of_whole"
  | "compare_metrics";

const INTENT_TO_CHART: Record<VizIntent, VizChartType> = {
  show_over_time: "line",
  show_revenue_over_time: "line",
  compare_categories: "bar",
  show_distribution: "bar",
  show_part_of_whole: "bar",
  compare_metrics: "bar",
};

function resolveChartType(
  intent: VizIntent,
  input: { subtype?: string | null }
): VizChartType {
  if (
    intent === "show_over_time" ||
    intent === "show_revenue_over_time" ||
    input.subtype === "daily"
  ) {
    return "line";
  }

  return INTENT_TO_CHART[intent];
}

export function aggregateSeriesByLabel(
  series: Array<{ label: string; value: number }>
): Array<{ label: string; value: number }> {
  const totals = new Map<string, number>();
  const order: string[] = [];

  for (const point of series) {
    if (!totals.has(point.label)) {
      order.push(point.label);
    }
    totals.set(point.label, (totals.get(point.label) ?? 0) + point.value);
  }

  return order.map((label) => ({ label, value: totals.get(label) ?? 0 }));
}

export function resolveVizSpec(input: {
  intent: string;
  title?: string;
  subtype?: string | null;
  series?: Array<{ label: string; value: number }>;
}): VizSpec {
  const intent = (Object.hasOwn(INTENT_TO_CHART, input.intent)
    ? input.intent
    : "compare_categories") as VizIntent;
  const data = aggregateSeriesByLabel(input.series ?? []);
  return {
    chartType: resolveChartType(intent, { subtype: input.subtype }),
    title: input.title,
    data,
    empty: data.length === 0,
  };
}

export function chartTypeToIntent(_chartType: "bar" | "pie"): VizIntent {
  return "compare_categories";
}

export function isVizIntent(value: string): value is VizIntent {
  return Object.hasOwn(INTENT_TO_CHART, value);
}
