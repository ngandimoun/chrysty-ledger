import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import type { LedgerWorkflowState } from "@/mastra/workflows/ledger-workflow-state";

export const loadWorkspaceContextStep = createStep({
  id: "load-workspace-context",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    files: z
      .array(
        z.object({
          fileId: z.string(),
          filename: z.string(),
          textContent: z.string().optional(),
        })
      )
      .optional(),
  }),
  outputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    workingMemorySummary: z.string().optional(),
    files: z.array(z.any()).optional(),
  }),
  stateSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    memoryThreadId: z.string(),
  }),
  execute: async ({ inputData, state }) => {
    const memory = getLedgerMemory();
    let workingMemorySummary: string | undefined;

    if (memory) {
      try {
        const working = await memory.getWorkingMemory({
          threadId: state.memoryThreadId || inputData.workspaceId,
          resourceId: inputData.userId,
        });
        if (working) {
          workingMemorySummary = JSON.stringify(working);
        }
      } catch {
        // Memory is best-effort for workflow context.
      }
    }

    return {
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      workingMemorySummary,
      files: inputData.files,
    };
  },
});
