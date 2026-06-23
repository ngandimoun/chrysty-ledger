"use client";

import { SeriesChart } from "@/components/viz/series-chart";
import type { ChartArtifact } from "@/lib/artifact-types";
import { aggregateSeriesByLabel } from "@/lib/viz/viz-engine";

type ArtifactChartProps = {
  artifact: ChartArtifact;
  compact?: boolean;
  className?: string;
};

export function ArtifactChart({ artifact, compact = false, className }: ArtifactChartProps) {
  return (
    <SeriesChart
      chartType="bar"
      data={aggregateSeriesByLabel(artifact.data)}
      title={artifact.title}
      compact={compact}
      className={className}
    />
  );
}
