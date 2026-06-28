"use client";

import { useChartReady } from "@/hooks/use-chart-ready";
import { SeriesChart } from "@/components/viz/series-chart";
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
  const isReady = useChartReady([asset.id, spec.chartType, spec.data.length]);

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

  if (!isReady) {
    return (
      <div
        className={cn(
          "flex h-[280px] w-full items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground",
          compact && "h-[180px]",
          className
        )}
      >
        Loading chart…
      </div>
    );
  }

  return (
    <SeriesChart
      chartType={spec.chartType === "grouped_bar" ? "bar" : spec.chartType}
      data={spec.data}
      title={spec.title ?? asset.title}
      compact={compact}
      className={className}
    />
  );
}
