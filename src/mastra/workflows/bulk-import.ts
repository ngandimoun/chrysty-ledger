import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { createMessageId } from "@/lib/chat-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { persistWorkspaceAsset } from "@/mastra/tools/create-asset";
import { approveMergeStep } from "@/mastra/workflows/steps/approve-merge";
import { loadWorkspaceContextStep } from "@/mastra/workflows/steps/load-workspace-context";
import { recordMemoryStep } from "@/mastra/workflows/steps/record-memory";
import { ledgerWorkflowStateSchema } from "@/mastra/workflows/ledger-workflow-state";
import { getLedgerScopeFromContext } from "@/mastra/request-context";

const fileInputSchema = z.object({
  fileId: z.string(),
  filename: z.string(),
  textContent: z.string().optional(),
});


const processFileStep = createStep({
  id: "process-receipt-file",
  inputSchema: fileInputSchema,
  outputSchema: z.object({
    fileId: z.string(),
    filename: z.string(),
    failed: z.boolean(),
    rows: z.array(z.record(z.string(), z.unknown())),
    error: z.string().nullable(),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, writer }) => {
    await writer?.custom({
      type: "data-file-status",
      data: {
        fileId: inputData.fileId,
        filename: inputData.filename,
        status: "processing",
      },
      transient: true,
    });

    try {
      const rows: Array<Record<string, unknown>> = [];
      if (inputData.textContent?.trim()) {
        const lines = inputData.textContent
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          rows.push({
            source: inputData.filename,
            description: line,
            amount: null,
          });
        }
      } else {
        rows.push({
          source: inputData.filename,
          description: `Imported file ${inputData.filename}`,
          amount: null,
        });
      }

      await writer?.custom({
        type: "data-file-status",
        data: {
          fileId: inputData.fileId,
          filename: inputData.filename,
          status: "success",
        },
        transient: true,
      });

      return {
        fileId: inputData.fileId,
        filename: inputData.filename,
        failed: false,
        rows,
        error: null,
      };
    } catch (error) {
      return {
        fileId: inputData.fileId,
        filename: inputData.filename,
        failed: true,
        rows: [],
        error: error instanceof Error ? error.message : "Extraction failed",
      };
    }
  },
});

const initializeBatchStep = createStep({
  id: "initialize-batch",
  inputSchema: z.object({
    workspaceId: z.string(),
    userId: z.string(),
    files: z.array(fileInputSchema),
  }),
  outputSchema: z.array(fileInputSchema),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      ...state,
      workspaceId: inputData.workspaceId,
      userId: inputData.userId,
      memoryThreadId: inputData.workspaceId,
      filesTotal: inputData.files.length,
      filesProcessed: 0,
      accumulatedRows: [],
      errors: [],
      assetIdsCreated: [],
    });
    return inputData.files;
  },
});

const mergeRowsStep = createStep({
  id: "merge-rows",
  inputSchema: z.array(
    z.object({
      fileId: z.string(),
      filename: z.string(),
      failed: z.boolean(),
      rows: z.array(z.record(z.string(), z.unknown())),
      error: z.string().nullable(),
    })
  ),
  outputSchema: z.object({
    workspaceId: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
    failedFiles: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.unknown())),
  }),
  stateSchema: ledgerWorkflowStateSchema,
  execute: async ({ inputData, state, setState }) => {
    const rows: Array<Record<string, unknown>> = [];
    const failedFiles: string[] = [];

    for (const file of inputData) {
      if (file.failed) {
        failedFiles.push(file.filename);
        continue;
      }
      rows.push(...file.rows);
    }

    await setState({
      ...state,
      accumulatedRows: rows,
      filesProcessed: inputData.length,
      errors: [
        ...state.errors,
        ...failedFiles.map((file) => ({ file, message: "Extraction failed" })),
      ],
    });

    return {
      workspaceId: state.workspaceId,
      rowCount: rows.length,
      previewAssetTitle: `Imported transactions (${rows.length} rows)`,
      failedFiles,
      rows,
    };
  },
});

const persistImportSheetStep = createStep({
  id: "persist-import-sheet",
  inputSchema: z.object({
    workspaceId: z.string(),
    rowCount: z.number(),
    previewAssetTitle: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())),
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
        workspaceId: state.workspaceId,
        userId: state.userId,
        summary: "Bulk import cancelled by user.",
        rowCount: inputData.rowCount,
        cancelled: true,
      };
    }

    const scope = getLedgerScopeFromContext(requestContext);
    if (!scope) {
      throw new Error("Ledger scope is not available in request context.");
    }

    const columns =
      inputData.rows.length > 0
        ? Object.keys(inputData.rows[0] ?? {})
        : ["source", "description", "amount"];

    const artifact: WorkspaceArtifact = {
      id: createMessageId(),
      kind: "table",
      title: inputData.previewAssetTitle,
      columns,
      rows: inputData.rows.map((row) =>
        Object.fromEntries(
          columns.map((column) => [column, String(row[column] ?? "")])
        )
      ),
    };

    const result = await persistWorkspaceAsset(
      scope,
      inputData.workspaceId,
      artifact
    );

    const assetIds = [...state.assetIdsCreated, result.asset.id];
    await setState({ ...state, assetIdsCreated: assetIds });

    return {
      workspaceId: state.workspaceId,
      userId: state.userId,
      summary: `Bulk import created sheet "${result.asset.title}" with ${inputData.rowCount} rows.`,
      assetId: result.asset.id,
      rowCount: inputData.rowCount,
      cancelled: false,
    };
  },
});

const bulkImportInputSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  files: z.array(fileInputSchema),
});

const bulkImportOutputSchema = z.object({
  assetId: z.string().optional(),
  rowCount: z.number(),
  cancelled: z.boolean(),
  recorded: z.boolean(),
});

export const bulkImportWorkflow = createWorkflow({
  id: "bulk-import",
  inputSchema: bulkImportInputSchema,
  outputSchema: bulkImportOutputSchema,
  stateSchema: ledgerWorkflowStateSchema,
  retryConfig: { attempts: 3, delay: 2000 },
})
  .then(loadWorkspaceContextStep)
  .map(async ({ inputData }) => ({
    workspaceId: inputData.workspaceId,
    userId: inputData.userId,
    files: z.array(fileInputSchema).parse(inputData.files ?? []),
  }))
  .then(initializeBatchStep)
  .foreach(processFileStep, { concurrency: 5 })
  .then(mergeRowsStep)
  .then(approveMergeStep)
  .then(persistImportSheetStep)
  .then(recordMemoryStep)
  .map(async ({ inputData }) => ({
    assetId: inputData.assetId,
    rowCount: inputData.rowCount,
    cancelled: inputData.cancelled,
    recorded: inputData.recorded,
  }))
  .commit();
