import type { CSSProperties } from "react";

/** Recharts does not inherit Tailwind theme — wire chart chrome to CSS variables. */
export function chartTickStyle(fontSize = 12): { fill: string; fontSize: number } {
  return { fill: "var(--muted-foreground)", fontSize };
}

export const chartAxisLine = { stroke: "var(--border)" };
export const chartTickLine = { stroke: "var(--border)" };

export const chartGridStroke = "var(--border)";

export const chartTooltipProps = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 12px color-mix(in oklch, var(--foreground) 12%, transparent)",
  } satisfies CSSProperties,
  labelStyle: { color: "var(--popover-foreground)" } satisfies CSSProperties,
  itemStyle: { color: "var(--popover-foreground)" } satisfies CSSProperties,
  cursor: { fill: "color-mix(in oklch, var(--muted-foreground) 18%, transparent)" },
};

export const chartLegendProps = {
  wrapperStyle: { color: "var(--muted-foreground)" } satisfies CSSProperties,
  iconType: "square" as const,
};
