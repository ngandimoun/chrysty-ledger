"use client";

import { SeriesChart, type SeriesPoint } from "@/components/viz/series-chart";
import { useContainerSize } from "@/hooks/use-container-size";
import type { VizChartType } from "@/lib/viz/viz-engine";
import { cn } from "@/lib/utils";

type MeasuredSeriesChartProps = {
  chartType: VizChartType;
  data: SeriesPoint[];
  title?: string;
  compact?: boolean;
  className?: string;
  remountSeed?: string | number;
};

export function MeasuredSeriesChart({
  chartType,
  data,
  title,
  compact = false,
  className,
  remountSeed,
}: MeasuredSeriesChartProps) {
  const { ref, width, isMeasured, remountKey } = useContainerSize();
  const height = compact ? 180 : 280;

  if (data.length === 0) {
    return (
      <SeriesChart
        chartType={chartType}
        data={data}
        title={title}
        compact={compact}
        className={className}
        width={0}
      />
    );
  }

  return (
    <div
      ref={ref}
      translate="no"
      className={cn("notranslate w-full min-w-0", className)}
      style={{ minHeight: height }}
    >
      {!isMeasured || width <= 0 ? (
        <div
          className={cn(
            "flex w-full items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground",
            compact ? "h-[180px]" : "h-[280px]"
          )}
        >
          Loading chart…
        </div>
      ) : (
        <SeriesChart
          key={`${remountSeed ?? "chart"}-${remountKey}-${width}-${data.length}`}
          chartType={chartType}
          data={data}
          title={title}
          compact={compact}
          width={width}
        />
      )}
    </div>
  );
}
