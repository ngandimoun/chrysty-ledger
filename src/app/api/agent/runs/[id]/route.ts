import { NextResponse } from "next/server";

import { getWorkflowRunState, resolveAgentRunContext } from "@/lib/agent/agent-route-helpers";
import { assertCoreProductionEnv, assertMastraProductionEnv, productionEnvErrorResponse } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(
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
  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId") as
    | "bulkImport"
    | "expenseAnalysis"
    | "scheduledReport"
    | null;
  const workspaceId = url.searchParams.get("workspaceId")?.trim() ?? "";

  if (!workflowId) {
    return NextResponse.json({ error: "workflowId query param is required." }, { status: 400 });
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId query param is required." }, { status: 400 });
  }

  const resolved = await resolveAgentRunContext(request, workspaceId);
  if ("error" in resolved) return resolved.error;

  const state = await getWorkflowRunState(workflowId, runId);
  if (!state) {
    return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
  }

  return NextResponse.json(state);
}
