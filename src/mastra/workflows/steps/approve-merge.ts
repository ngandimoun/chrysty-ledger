import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { ledgerWorkflowStateSchema } from "@/mastra/workflows/ledger-workflow-state";

export const approveMergeStep = createStep({
  id: "approve-merge",
  inputSchema: z.object({
    workspaceId: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
    failedFiles: z.array(z.string()).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  outputSchema: z.object({
    workspaceId: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())),
    approvedBy: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
    failedFiles: z.array(z.string()).optional(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    note: z.string().optional(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const { approved, note } = resumeData ?? {};
    const rows = inputData.rows ?? [];

    if (approved === false) {
      return bail({
        workspaceId: inputData.workspaceId,
        rowCount: inputData.rowCount,
        previewAssetTitle: inputData.previewAssetTitle,
        rows,
        approvedBy: "rejected",
      });
    }

    if (!approved) {
      return await suspend({
        reason: "Review extracted rows before creating the sheet asset.",
        rowCount: inputData.rowCount,
        previewAssetTitle: inputData.previewAssetTitle,
        failedFiles: inputData.failedFiles,
      });
    }

    return {
      workspaceId: inputData.workspaceId,
      rowCount: inputData.rowCount,
      previewAssetTitle: inputData.previewAssetTitle,
      rows,
      approvedBy: "user",
    };
  },
});
