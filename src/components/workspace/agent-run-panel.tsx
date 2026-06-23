"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { useAgentRun } from "@/hooks/use-agent-run";

type AgentRunPanelProps = {
  agentRun: ReturnType<typeof useAgentRun>;
};

export function AgentRunPanel({ agentRun }: AgentRunPanelProps) {
  const {
    isRunning,
    status,
    steps,
    foreachProgress,
    analystLog,
    suspendPayload,
    error,
    approveRun,
    rejectRun,
  } = agentRun;

  if (!isRunning && !status && !error) {
    return null;
  }

  const showHitl = status === "suspended" && suspendPayload;

  return (
    <Card className="border-border/80 bg-card/95 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Agent workflow</h3>
        {isRunning ? (
          <span className="text-xs text-muted-foreground">Running…</span>
        ) : (
          <span className="text-xs text-muted-foreground">{status}</span>
        )}
      </div>

      {steps.length > 0 ? (
        <ol className="space-y-1 text-xs">
          {steps.map((step) => (
            <li key={step.stepName} className="flex justify-between gap-2">
              <span>{step.stepName}</span>
              <span className="text-muted-foreground">{step.status}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {foreachProgress ? (
        <p className="text-xs text-muted-foreground">
          Files {foreachProgress.completed}/{foreachProgress.total}
        </p>
      ) : null}

      {analystLog ? (
        <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">
          {analystLog}
        </pre>
      ) : null}

      {showHitl ? (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Approval required</p>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(suspendPayload, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void approveRun()}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => void rejectRun()}>
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </Card>
  );
}
