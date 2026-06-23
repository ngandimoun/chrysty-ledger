export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function colorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

const CURRENCY_HINT = /[₹$€£]|currency|total\s*\(|amount/i;

export function formatChartValue(value: number, hints?: { title?: string; labels?: string[] }) {
  const title = hints?.title ?? "";
  const labels = hints?.labels ?? [];
  const useCurrency =
    CURRENCY_HINT.test(title) || labels.some((label) => CURRENCY_HINT.test(label));

  if (useCurrency) {
    if (/₹/.test(title) || labels.some((label) => /₹/.test(label))) {
      return `₹${value.toLocaleString()}`;
    }
    return `$${value.toLocaleString()}`;
  }

  return value.toLocaleString();
}

export function chartDonutRadii(compact: boolean) {
  return {
    innerRadius: compact ? 40 : 60,
    outerRadius: compact ? 70 : 100,
  };
}
