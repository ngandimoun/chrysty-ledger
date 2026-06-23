import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { createMessageId } from "@/lib/chat-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { listAssetsTool } from "@/mastra/tools/list-assets";
import { persistWorkspaceAsset } from "@/mastra/tools/create-asset";
import { ledgerReporter } from "@/mastra/agents";
import { getLedgerScopeFromContext } from "@/mastra/request-context";
import { loadWorkspaceContextStep } from "@/mastra/workflows/steps/load-workspace-context";
import { recordMemoryStep } from "@/mastra/workflows/steps/record-memory";
import { ledgerWorkflowStateSchema } from "@/mastra/workflows/ledger-workflow-state";

const scheduledReportInputSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  reportTitle: z.string().optional(),
});

const generateReportStep = createStep({
  id: "generate-report",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    assetsSummary: z.string(),
    reportTitle: z.string().optional(),
  }),
  outputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    overwrite: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const reporter = mastra.getAgent("ledgerReporter");
    const prompt = `Create an executive report for this workspace.
Assets: ${inputData.assetsSummary}
Title: ${inputData.reportTitle ?? "Weekly ledger report"}`;

    const response = await reporter.generate([{ role: "user", content: prompt }], {
      memory: {
        thread: inputData.workspaceId,
        resource: inputData.userId,
      },
    });

    const artifact: WorkspaceArtifact = {
      id: createMessageId(),
      kind: "document",
      title: inputData.reportTitle ?? "Weekly ledger report",
      content: response.text,
    };

    return {
      artifact,
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      overwrite: inputData.assetsSummary.includes("report"),
    };
  },
});

const approveOverwriteStep = createStep({
  id: "approve-overwrite",
  inputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    overwrite: z.boolean(),
  }),
  outputSchema: z.object({
    artifact: z.custom<WorkspaceArtifact>(),
    workspaceId: z.string(),
    userId: z.string(),
    approvedBy: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    previewAssetTitle: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
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
    if (!approved && inputData.overwrite) {
      return await suspend({
        reason: "An existing report may be overwritten.",
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

const persistReportStep = createStep({
  id: "persist-report",
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
  execute: async ({ inputData, requestContext }) => {
    if (inputData.approvedBy === "rejected") {
      return {
        workspaceId: inputData.workspaceId,
        userId: inputData.userId,
        summary: "Scheduled report cancelled.",
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

    return {
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      summary: `Scheduled report created: ${result.asset.title}`,
      assetId: result.asset.id,
      rowCount: 1,
      cancelled: false,
    };
  },
});

export const scheduledReportWorkflow = createWorkflow({
  id: "scheduled-report",
  inputSchema: scheduledReportInputSchema,
  outputSchema: z.object({
    assetId: z.string().optional(),
    cancelled: z.boolean(),
    recorded: z.boolean(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
})
  .then(loadWorkspaceContextStep)
  .map(async ({ getInitData }) => {
    const init = getInitData<z.infer<typeof scheduledReportInputSchema>>();
    return {
      workspaceId: init.workspaceId,
      userId: init.userId,
    };
  })
  .then(createStep(listAssetsTool))
  .map(async ({ inputData, getInitData }) => {
    const init = getInitData<z.infer<typeof scheduledReportInputSchema>>();
    const assetsSummary = inputData.assets
      .map((asset) => `${asset.title} (${asset.category})`)
      .join(", ");
    return {
      workspaceId: init.workspaceId,
      userId: init.userId,
      assetsSummary,
      reportTitle: init.reportTitle,
    };
  })
  .then(generateReportStep)
  .then(approveOverwriteStep)
  .then(persistReportStep)
  .then(recordMemoryStep)
  .map(async ({ inputData }) => ({
    assetId: inputData.assetId,
    cancelled: inputData.cancelled,
    recorded: inputData.recorded,
  }))
  .commit();
