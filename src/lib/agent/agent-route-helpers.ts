import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createWorkflowStateReader } from "@mastra/core/workflows";

import { isMastraAgentLayerEnabled } from "@/lib/agent/mastra-enabled";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import {
  createLedgerScope,
  parseLedgerIdentityFromBody,
  parseLedgerIdentityFromHeaders,
} from "@/lib/ledger/server-scope";
import { getMastra } from "@/mastra";

export const runtime = "nodejs";

type WorkflowKey = "bulkImport" | "expenseAnalysis" | "scheduledReport";

export async function resolveAgentRunContext(request: NextRequest, workspaceId: string) {
  try {
    await requirePlatformAccess(request);
  } catch (error) {
    if (error instanceof PlatformAccessError) {
      return {
        error: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    throw error;
  }

  const identity =
    parseLedgerIdentityFromHeaders(request) ?? (await parseLedgerIdentityFromBody(request));
  if (!identity) {
    return { error: NextResponse.json({ error: "Missing ledger identity." }, { status: 401 }) };
  }

  const mastra = getMastra();
  if (!mastra || !isMastraAgentLayerEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Mastra agent layer is not configured (DATABASE_URL + MOONSHOT_API_KEY)." },
        { status: 503 }
      ),
    };
  }

  return {
    mastra,
    scope: createLedgerScope(identity),
    userId: identity.userId ?? identity.ledgerKey,
    workspaceId,
  };
}

export async function getWorkflowRunState(workflowKey: WorkflowKey, runId: string) {
  const mastra = getMastra();
  if (!mastra) return null;

  const workflow = mastra.getWorkflow(workflowKey);
  const state = await workflow.getWorkflowRunById(runId);
  if (!state) return null;

  const reader = createWorkflowStateReader(state);
  const suspendedStep = reader.getSuspendedStep();

  return {
    runId: state.runId,
    workflowId: workflowKey,
    status: state.status,
    suspendedStep,
    steps: state.steps,
  };
}
