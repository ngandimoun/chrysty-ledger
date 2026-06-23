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

  const { id: runId } = await context.params;
  const body = (await request.json()) as {
    workspaceId: string;
    workflowId: "bulkImport" | "expenseAnalysis" | "scheduledReport";
    resumeData?: Record<string, unknown>;
    step?: string;
    forEachIndex?: number;
  };

  if (!body.workspaceId || !body.workflowId) {
    return NextResponse.json(
      { error: "workspaceId and workflowId are required." },
      { status: 400 }
    );
  }

  const resolved = await resolveAgentRunContext(request, body.workspaceId);
  if ("error" in resolved) return resolved.error;

  return createAgentWorkflowSseResponse(
    async ({ push, requestContext }) => {
      const workflow = resolved.mastra.getWorkflow(body.workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.resumeStream({
        step: body.step,
        resumeData: body.resumeData ?? { approved: true },
        forEachIndex: body.forEachIndex,
        requestContext,
      });

      await pipeWorkflowStream(stream, push);
      const result = await stream.result;

      return {
        runId,
        workflowId: body.workflowId,
        status: result.status,
        suspended: result.status === "suspended" ? result.suspended : undefined,
        result: result.status === "success" ? result.result : undefined,
      };
    },
    {
      scope: resolved.scope,
      workspaceId: body.workspaceId,
      userId: resolved.userId,
      workflowId: body.workflowId,
    },
    { request }
  );
}
