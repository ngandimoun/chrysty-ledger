import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { createMessageId } from "@/lib/chat-types";
import type { LedgerWorkingMemory } from "@/lib/schemas/ledger-working-memory";
import { sanitizeWorkflowMemoryText } from "@/lib/agent/ledger-guardrails";
import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import { ledgerWorkflowStateSchema } from "@/mastra/workflows/ledger-workflow-state";

export const recordMemoryStep = createStep({
  id: "record-memory",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    summary: z.string(),
    assetId: z.string().optional(),
    rowCount: z.number().optional(),
    cancelled: z.boolean().optional(),
  }),
  outputSchema: z.object({
    recorded: z.boolean(),
    assetId: z.string().optional(),
    rowCount: z.number(),
    cancelled: z.boolean(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const memory = getLedgerMemory();

    if (memory) {
      try {
        const threadId = state.memoryThreadId || inputData.workspaceId;
        const existing = await memory.getWorkingMemory({
          threadId,
          resourceId: inputData.userId,
        });

        let current: LedgerWorkingMemory = {};
        if (typeof existing === "string" && existing.trim()) {
          try {
            current = JSON.parse(existing) as LedgerWorkingMemory;
          } catch {
            current = {};
          }
        } else if (existing && typeof existing === "object") {
          current = existing as LedgerWorkingMemory;
        }

        await memory.updateWorkingMemory({
          threadId,
          resourceId: inputData.userId,
          workingMemory: JSON.stringify({
            ...current,
            lastMajorAnalysis: sanitizeWorkflowMemoryText(inputData.summary),
          }),
        });
      } catch {
        // Best-effort memory write.
      }
    }

    await setState({
      ...state,
      assetIdsCreated: state.assetIdsCreated,
    });

    return {
      recorded: Boolean(memory),
      assetId: inputData.assetId,
      rowCount: inputData.rowCount ?? 0,
      cancelled: inputData.cancelled ?? false,
    };
  },
});

export function buildWorkflowMemorySummary(
  workflowName: string,
  assetIds: string[]
): string {
  const assetPart =
    assetIds.length > 0 ? ` Assets: ${assetIds.join(", ")}.` : "";
  return `[${workflowName}] Completed workflow run.${assetPart}`;
}

export function newArtifactId(): string {
  return createMessageId();
}
