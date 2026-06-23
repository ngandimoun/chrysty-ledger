import "server-only";

import { sanitizeWorkflowMemoryText, limitContextTokens } from "@/lib/agent/ledger-guardrails";
import { listAssetsV2 } from "@/lib/assets/service";
import type { LedgerScope } from "@/lib/ledger/scope";
import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import type { LedgerWorkingMemory } from "@/lib/schemas/ledger-working-memory";
import type { LedgerRoute } from "@/lib/ai/orchestrator/ledger-route-types";

function parseWorkingMemory(existing: unknown): LedgerWorkingMemory {
  if (typeof existing === "string" && existing.trim()) {
    try {
      return JSON.parse(existing) as LedgerWorkingMemory;
    } catch {
      return {};
    }
  }
  if (existing && typeof existing === "object") {
    return existing as LedgerWorkingMemory;
  }
  return {};
}

export async function loadWorkingMemoryRecord(
  workspaceId: string,
  userId: string
): Promise<LedgerWorkingMemory | null> {
  const memory = getLedgerMemory();
  if (!memory) return null;

  try {
    const working = await memory.getWorkingMemory({
      threadId: workspaceId,
      resourceId: userId,
    });
    return parseWorkingMemory(working);
  } catch {
    return null;
  }
}

export async function buildRecentAssetsContext(
  scope: LedgerScope,
  workspaceId: string,
  limit = 5
): Promise<string | null> {
  try {
    const assets = await listAssetsV2(scope, workspaceId);
    if (assets.length === 0) return null;

    const recent = assets.slice(0, limit);
    const lines = recent.map(
      (asset) => `- ${asset.title} (${asset.kind}${asset.subtype ? `/${asset.subtype}` : ""}) id=${asset.id}`
    );
    return limitContextTokens(`Recent workspace assets:\n${lines.join("\n")}`);
  } catch {
    return null;
  }
}

export async function recordChatTurnMemory(input: {
  workspaceId: string;
  userId: string;
  route: LedgerRoute;
  userInput: string;
  assistantSummary: string;
  attachmentNames?: string[];
  assetIds?: string[];
  searchTopic?: string;
}): Promise<void> {
  const memory = getLedgerMemory();
  if (!memory || !input.workspaceId || !input.userId) return;

  try {
    const existing = await memory.getWorkingMemory({
      threadId: input.workspaceId,
      resourceId: input.userId,
    });
    const current = parseWorkingMemory(existing);

    const summary = sanitizeWorkflowMemoryText(
      input.assistantSummary.trim() || input.userInput.trim()
    );

    const recentAssets = [...(current.recentAssets ?? [])];
    for (const assetId of input.assetIds ?? []) {
      recentAssets.unshift({
        assetId,
        title: summary.slice(0, 80) || "Workspace asset",
        kind: "asset",
        createdAt: new Date().toISOString(),
      });
    }

    const next: LedgerWorkingMemory = {
      ...current,
      lastMajorAnalysis: summary,
      recentAssets: recentAssets.slice(0, 8),
      lastTurn: {
        route: input.route === "search" ? "search" : input.route === "create_asset" ? "create_asset" : "chat",
        summary,
        attachmentNames: input.attachmentNames,
        searchTopic: input.searchTopic,
      },
    };

    await memory.updateWorkingMemory({
      threadId: input.workspaceId,
      resourceId: input.userId,
      workingMemory: JSON.stringify(next),
    });
  } catch {
    // Best-effort memory write.
  }
}
