import { ArtifactChart } from "@/components/workspace/artifact-chart";
import type { DashboardArtifact } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";

type AssetDashboardProps = {
  artifact: DashboardArtifact;
  className?: string;
};

export function AssetDashboard({ artifact, className }: AssetDashboardProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {artifact.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {kpi.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {artifact.chart && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <ArtifactChart
            artifact={{
              id: artifact.id,
              kind: "chart",
              title: artifact.title,
              chartType: artifact.chart.chartType,
              data: artifact.chart.data,
            }}
          />
        </div>
      )}
    </div>
  );
}
