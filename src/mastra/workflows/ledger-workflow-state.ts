import { z } from "zod";

export const ledgerWorkflowStateSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  assetIdsCreated: z.array(z.string()),
  filesProcessed: z.number(),
  filesTotal: z.number(),
  accumulatedRows: z.array(z.record(z.string(), z.unknown())),
  errors: z.array(z.object({ file: z.string(), message: z.string() })),
  memoryThreadId: z.string(),
});

export type LedgerWorkflowState = z.infer<typeof ledgerWorkflowStateSchema>;

export function createInitialLedgerWorkflowState(input: {
  workspaceId: string;
  userId: string;
  filesTotal?: number;
}): LedgerWorkflowState {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    assetIdsCreated: [],
    filesProcessed: 0,
    filesTotal: input.filesTotal ?? 0,
    accumulatedRows: [],
    errors: [],
    memoryThreadId: input.workspaceId,
  };
}
