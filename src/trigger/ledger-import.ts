import { task } from "@trigger.dev/sdk";

import { getMastra } from "@/mastra";
import { createInitialLedgerWorkflowState } from "@/mastra/workflows/ledger-workflow-state";
import { buildLedgerRequestContext } from "@/lib/agent/workflow-run";
import { createLedgerScope } from "@/lib/ledger/server-scope";

export const ledgerImportTask = task({
  id: "ledger-import",
  run: async (payload: {
    workspaceId: string;
    userId: string;
    ledgerKey: string;
    files: Array<{ fileId: string; filename: string; textContent?: string }>;
  }) => {
    const mastra = getMastra();
    if (!mastra) {
      return { status: "skipped", reason: "Mastra not configured" };
    }

    const scope = createLedgerScope({ ledgerKey: payload.ledgerKey, userId: payload.userId });
    const workflow = mastra.getWorkflow("bulkImport");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        files: payload.files,
      },
      initialState: createInitialLedgerWorkflowState({
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        filesTotal: payload.files.length,
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
