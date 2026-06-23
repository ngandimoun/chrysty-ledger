import { NextResponse } from "next/server";

import { resolveAgentRunContext } from "@/lib/agent/agent-route-helpers";
import {
  createAgentWorkflowSseResponse,
  pipeWorkflowStream,
} from "@/lib/agent/workflow-run";
import { assertCoreProductionEnv, assertMastraProductionEnv, productionEnvErrorResponse } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertCoreProductionEnv();
    assertMastraProductionEnv();
  } catch (error) {
    return productionEnvErrorResponse(error);
  }

  const { id: workspaceId } = await context.params;
  const resolved = await resolveAgentRunContext(request, workspaceId);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json()) as {
    files: Array<{ fileId: string; filename: string; textContent?: string }>;
  };

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "files array is required." }, { status: 400 });
  }

  return createAgentWorkflowSseResponse(
    async ({ push, requestContext, initialState }) => {
      const workflow = resolved.mastra.getWorkflow("bulkImport");
      const run = await workflow.createRun();
      const stream = await run.stream({
        inputData: {
          workspaceId,
          userId: resolved.userId,
          files: body.files,
        },
        initialState: {
          ...initialState,
          filesTotal: body.files.length,
        },
        requestContext,
      });

      await pipeWorkflowStream(stream, push);
      const result = await stream.result;

      return {
        runId: run.runId,
        workflowId: "bulkImport",
        status: result.status,
        suspended: result.status === "suspended" ? result.suspended : undefined,
        result: result.status === "success" ? result.result : undefined,
      };
    },
    {
      scope: resolved.scope,
      workspaceId,
      userId: resolved.userId,
      workflowId: "bulkImport",
      filesTotal: body.files.length,
    },
    { request }
  );
}
