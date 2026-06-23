import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { createMessageId } from "@/lib/chat-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { listAssets as listLedgerAssets } from "@/lib/ledger/assets";
import { persistWorkspaceAsset } from "@/mastra/tools/create-asset";
import { getLedgerScopeFromContext } from "@/mastra/request-context";
import { approveMergeStep } from "@/mastra/workflows/steps/approve-merge";
import { loadWorkspaceContextStep } from "@/mastra/workflows/steps/load-workspace-context";
import { recordMemoryStep } from "@/mastra/workflows/steps/record-memory";
import { ledgerWorkflowStateSchema } from "@/mastra/workflows/ledger-workflow-state";

const expenseAnalysisInputSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  assetId: z.string().optional(),
  prompt: z.string().optional(),
});

const prepareExpenseContextStep = createStep({
  id: "prepare-expense-context",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    workingMemorySummary: z.string().optional(),
    files: z.array(z.any()).optional(),
  }),
  outputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    workingMemorySummary: z.string().optional(),
    assetContext: z.string(),
    prompt: z.string().optional(),
  }),
  execute: async ({ inputData, requestContext, getInitData }) => {
    const init = getInitData<z.infer<typeof expenseAnalysisInputSchema>>();
    const scope = getLedgerScopeFromContext(requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const assets = await listLedgerAssets(scope, inputData.workspaceId);
    const assetContext = assets
      .filter((asset) => !init.assetId || asset.id === init.assetId)
      .map((asset) => `${asset.title} (${asset.category})`)
      .join(", ");

    return {
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      workingMemorySummary: inputData.workingMemorySummary,
      assetContext,
      prompt: init.prompt,
    };
  },
});

const analyzeExpensesStep = createStep({
  id: "analyze-expenses",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    workingMemorySummary: z.string().optional(),
    assetContext: z.string().optional(),
    prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const analyst = mastra.getAgent("ledgerAnalyst");
    const prompt = [
      inputData.prompt ?? "Analyze workspace expenses and highlight trends.",
      inputData.workingMemorySummary
        ? `Working memory: ${inputData.workingMemorySummary}`
        : "",
      inputData.assetContext ? `Assets: ${inputData.assetContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const stream = await analyst.stream([{ role: "user", content: prompt }], {
      memory: {
        thread: inputData.workspaceId,
        resource: inputData.userId,
      },
    });

    const reader = stream.fullStream.getReader();
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }

        if (chunk.type === "text-delta" && "payload" in chunk) {
          const text =
            typeof chunk.payload === "object" &&
            chunk.payload &&
            "text" in chunk.payload
              ? String((chunk.payload as { text?: string }).text ?? "")
              : "";
          if (text) {
            await writer?.custom({
              type: "data-analyst-delta",
              data: { text },
              transient: true,
            });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const analysis = await stream.text;
    return {
      analysis,
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
    };
  },
});

const buildDashboardStep = createStep({
  id: "build-dashboard-artifact",
  inputSchema: z.object({
    analysis: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
  }),
  outputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    rowCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const artifact: WorkspaceArtifact = {
      id: createMessageId(),
      kind: "document",
      title: "Expense analysis",
      content: inputData.analysis,
    };
    return {
      artifact,
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      rowCount: 1,
    };
  },
});

const approveWritesStep = createStep({
  id: "approve-writes",
  inputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    rowCount: z.number(),
  }),
  outputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    approvedBy: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    note: z.string().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const { approved } = resumeData ?? {};
    if (approved === false) {
      return bail({
        artifact: inputData.artifact,
        workspaceId: inputData.workspaceId,
        userId: inputData.userId,
        approvedBy: "rejected",
      });
    }
    if (!approved && inputData.rowCount > 0) {
      return await suspend({
        reason: "Approve creating expense analysis assets.",
        rowCount: inputData.rowCount,
        previewAssetTitle: inputData.artifact.title,
      });
    }
    return {
      artifact: inputData.artifact,
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      approvedBy: "user",
    };
  },
});

const persistExpenseAssetStep = createStep({
  id: "persist-expense-assets",
  inputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    approvedBy: z.string().optional(),
  }),
  outputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    summary: z.string(),
    assetId: z.string().optional(),
    rowCount: z.number(),
    cancelled: z.boolean(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, state, setState, requestContext }) => {
    if (inputData.approvedBy === "rejected") {
      return {
        workspaceId: inputData.workspaceId,
        userId: inputData.userId,
        summary: "Expense analysis cancelled by user.",
        rowCount: 0,
        cancelled: true,
      };
    }

    const scope = getLedgerScopeFromContext(requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const result = await persistWorkspaceAsset(
      scope,
      inputData.workspaceId,
      inputData.artifact
    );

    await setState({
      ...state,
      assetIdsCreated: [...state.assetIdsCreated, result.asset.id],
    });

    return {
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      summary: `Expense analysis created dashboard "${result.asset.title}".`,
      assetId: result.asset.id,
      rowCount: 1,
      cancelled: false,
    };
  },
});

export const expenseAnalysisWorkflow = createWorkflow({
  id: "expense-analysis",
  inputSchema: expenseAnalysisInputSchema,
  outputSchema: z.object({
    assetId: z.string().optional(),
    cancelled: z.boolean(),
    recorded: z.boolean(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
})
  .then(loadWorkspaceContextStep)
  .then(prepareExpenseContextStep)
  .then(analyzeExpensesStep)
  .then(buildDashboardStep)
  .then(approveWritesStep)
  .then(persistExpenseAssetStep)
  .then(recordMemoryStep)
  .map(async ({ inputData }) => ({
    assetId: inputData.assetId,
    cancelled: inputData.cancelled,
    recorded: inputData.recorded,
  }))
  .commit();
