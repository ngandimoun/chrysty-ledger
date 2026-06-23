import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callFormulaFiber } from "@/lib/ai/formulas-api";

export const kimiFormulaTool = createTool({
  id: "kimi-formula",
  description: "Run a Kimi formula fiber against spreadsheet or file data.",
  inputSchema: z.object({
    formulaUri: z.string(),
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  }),
  outputSchema: z.object({
    output: z.string().nullable(),
    status: z.string(),
    error: z.string().nullable(),
  }),
  execute: async (inputData, context) => {
    await context?.writer?.custom({
      type: "data-excel-progress",
      data: { status: "running", formula: inputData.name },
      transient: true,
    });

    const result = await callFormulaFiber(
      inputData.formulaUri,
      inputData.name,
      inputData.arguments
    );

    await context?.writer?.custom({
      type: "data-excel-progress",
      data: { status: result.success ? "completed" : "failed" },
      transient: true,
    });

    return {
      output: result.content || null,
      status: result.success ? "succeeded" : "failed",
      error: result.error ?? null,
    };
  },
});
