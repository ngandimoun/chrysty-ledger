"use client";

import { useChartReady } from "@/hooks/use-chart-ready";
import { SeriesChart } from "@/components/viz/series-chart";
import type { ChartArtifact } from "@/lib/artifact-types";
import { aggregateSeriesByLabel } from "@/lib/viz/viz-engine";
import { cn } from "@/lib/utils";

type ArtifactChartProps = {
  artifact: ChartArtifact;
  compact?: boolean;
  className?: string;
};

export function ArtifactChart({ artifact, compact = false, className }: ArtifactChartProps) {
  const data = aggregateSeriesByLabel(artifact.data);
  const isReady = useChartReady([artifact.id, data.length]);

  if (data.length === 0) {
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
      chartType="bar"
      data={data}
      title={artifact.title}
      compact={compact}
      className={className}
    />
  );
}
