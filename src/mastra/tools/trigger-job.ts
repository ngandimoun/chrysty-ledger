import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const triggerLedgerJobTool = createTool({
  id: "trigger-ledger-job",
  description: "Enqueue a Trigger.dev background job for bulk import or scheduled reports.",
  requireApproval: true,
  inputSchema: z.object({
    job: z.enum(["ledger-import", "ledger-report", "ledger-invoice"]),
    workspaceId: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  outputSchema: z.object({
    job: z.string(),
    status: z.literal("queued"),
    workspaceId: z.string(),
  }),
  execute: async (inputData) => {
    return {
      job: inputData.job,
      status: "queued" as const,
      workspaceId: inputData.workspaceId,
    };
  },
});
