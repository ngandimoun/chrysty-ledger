"use client";

import { MeasuredSeriesChart } from "@/components/viz/measured-series-chart";
import type { Asset } from "@/lib/assets/asset";
import { resolveVizSpec } from "@/lib/viz/viz-engine";
import { cn } from "@/lib/utils";

type ChartRendererProps = {
  asset: Asset;
  compact?: boolean;
  className?: string;
};

export function ChartRenderer({ asset, compact = false, className }: ChartRendererProps) {
  const series = (asset.data.series as { label: string; value: number }[]) ?? [];
  const spec = resolveVizSpec({
    intent: String(asset.schema.intent ?? "compare_categories"),
    title: asset.title,
    subtype: asset.subtype,
    series,
  });

  if (spec.empty) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        No chart data available.
      </div>
    );
  }

  return (
    <MeasuredSeriesChart
      chartType={spec.chartType === "grouped_bar" ? "bar" : spec.chartType}
      data={spec.data}
      title={spec.title ?? asset.title}
      compact={compact}
      className={className}
      remountSeed={asset.id}
    />
  );
}
