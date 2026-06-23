import "server-only";

import { NextResponse } from "next/server";

import { isMastraAgentLayerEnabled } from "@/lib/agent/mastra-enabled";
import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import { createLedgerScope, parseLedgerIdentityFromHeaders } from "@/lib/ledger/server-scope";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await context.params;

  if (!isMastraAgentLayerEnabled()) {
    return NextResponse.json({
      workingMemory: null,
      observations: [],
      enabled: false,
    });
  }

  const identity = parseLedgerIdentityFromHeaders(request);
  if (!identity) {
    return NextResponse.json({ error: "Missing x-ledger-key header." }, { status: 401 });
  }

  const memory = getLedgerMemory();
  if (!memory) {
    return NextResponse.json({ workingMemory: null, observations: [], enabled: false });
  }

  const resourceId = identity.userId ?? identity.ledgerKey;

  try {
    const workingMemory = await memory.getWorkingMemory({
      threadId: workspaceId,
      resourceId,
    });

    return NextResponse.json({
      enabled: true,
      workingMemory,
      observations: [],
    });
  } catch (error) {
    return NextResponse.json({
      enabled: true,
      workingMemory: null,
      observations: [],
      error: error instanceof Error ? error.message : "Failed to load memory",
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await context.params;
  const body = (await request.json()) as { query?: string };

  if (!isMastraAgentLayerEnabled()) {
    return NextResponse.json({ results: [], enabled: false });
  }

  const identity = parseLedgerIdentityFromHeaders(request);
  if (!identity) {
    return NextResponse.json({ error: "Missing x-ledger-key header." }, { status: 401 });
  }

  const memory = getLedgerMemory();
  if (!memory || !body.query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  const resourceId = identity.userId ?? identity.ledgerKey;

  try {
    const recalled = await memory.recall({
      threadId: workspaceId,
      resourceId,
      vectorSearchString: body.query,
      perPage: 5,
    });

    return NextResponse.json({ results: recalled?.messages ?? [] });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
