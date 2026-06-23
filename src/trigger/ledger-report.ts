import { schedules, task } from "@trigger.dev/sdk";

import { getMastra } from "@/mastra";
import { createInitialLedgerWorkflowState } from "@/mastra/workflows/ledger-workflow-state";
import { buildLedgerRequestContext } from "@/lib/agent/workflow-run";
import { createLedgerScope } from "@/lib/ledger/server-scope";

export const ledgerReportTask = task({
  id: "ledger-report",
  run: async (payload: {
    workspaceId: string;
    userId: string;
    ledgerKey: string;
    reportTitle?: string;
  }) => {
    const mastra = getMastra();
    if (!mastra) {
      return { status: "skipped", reason: "Mastra not configured" };
    }

    const scope = createLedgerScope({ ledgerKey: payload.ledgerKey, userId: payload.userId });
    const workflow = mastra.getWorkflow("scheduledReport");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        reportTitle: payload.reportTitle,
      },
      initialState: createInitialLedgerWorkflowState({
        workspaceId: payload.workspaceId,
        userId: payload.userId,
      }),
      requestContext: buildLedgerRequestContext(scope, payload.workspaceId, payload.userId),
    });

    return {
      workspaceId: payload.workspaceId,
      status: result.status,
      result: result.status === "success" ? result.result : undefined,
      runId: run.runId,
    };
  },
});

export const ledgerReportSchedule = schedules.task({
  id: "ledger-report-weekly",
  cron: "0 9 * * 1",
  run: async () => {
    return { status: "noop", message: "Fan-out per workspace from application scheduler." };
  },
});
