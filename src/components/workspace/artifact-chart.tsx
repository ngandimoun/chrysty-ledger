"use client";

import { MeasuredSeriesChart } from "@/components/viz/measured-series-chart";
import type { ChartArtifact } from "@/lib/artifact-types";
import { aggregateSeriesByLabel } from "@/lib/viz/viz-engine";

type ArtifactChartProps = {
  artifact: ChartArtifact;
  compact?: boolean;
  className?: string;
};

export function ArtifactChart({ artifact, compact = false, className }: ArtifactChartProps) {
  const data = aggregateSeriesByLabel(artifact.data);

  return (
    <MeasuredSeriesChart
      chartType="bar"
      data={data}
      title={artifact.title}
      compact={compact}
      className={className}
      remountSeed={artifact.id}
    />
  );
}
