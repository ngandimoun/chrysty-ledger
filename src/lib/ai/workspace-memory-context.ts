import "server-only";

import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import { isMastraAgentLayerEnabled } from "@/lib/agent/mastra-enabled";
import { limitContextTokens } from "@/lib/agent/ledger-guardrails";
import type { LedgerWorkingMemory } from "@/lib/schemas/ledger-working-memory";

function parseWorkingMemory(working: unknown): LedgerWorkingMemory {
  if (typeof working === "string" && working.trim()) {
    try {
      return JSON.parse(working) as LedgerWorkingMemory;
    } catch {
      return {};
    }
  }
  if (working && typeof working === "object") {
    return working as LedgerWorkingMemory;
  }
  return {};
}

export async function buildWorkspaceMemoryContext(
  workspaceId: string,
  userId: string
): Promise<string | null> {
  if (!isMastraAgentLayerEnabled()) {
    return null;
  }

  const memory = getLedgerMemory();
  if (!memory) return null;

  try {
    const working = await memory.getWorkingMemory({
      threadId: workspaceId,
      resourceId: userId,
    });

    const record = parseWorkingMemory(working);
    const parts: string[] = [];

    if (record.businessName) parts.push(`Business: ${record.businessName}`);
    if (record.currency) parts.push(`Currency: ${record.currency}`);
    if (record.accountingBasis) parts.push(`Basis: ${record.accountingBasis}`);
    if (record.lastMajorAnalysis) {
      parts.push(`Last analysis: ${record.lastMajorAnalysis}`);
    }
    if (Array.isArray(record.openGoals) && record.openGoals.length > 0) {
      parts.push(`Open goals: ${record.openGoals.join("; ")}`);
    }
    if (record.lastTurn?.summary) {
      parts.push(`Last turn (${record.lastTurn.route ?? "chat"}): ${record.lastTurn.summary}`);
    }
    if (record.lastTurn?.attachmentNames?.length) {
      parts.push(`Last attachments: ${record.lastTurn.attachmentNames.join(", ")}`);
    }
    if (record.lastTurn?.searchTopic) {
      parts.push(`Last search topic: ${record.lastTurn.searchTopic}`);
    }
    if (Array.isArray(record.recentAssets) && record.recentAssets.length > 0) {
      const assetLines = record.recentAssets
        .slice(0, 5)
        .map((asset) => `${asset.title} (${asset.kind}, id=${asset.assetId})`);
      parts.push(`Recent assets: ${assetLines.join("; ")}`);
    }

    if (parts.length === 0) return null;
    return limitContextTokens(
      `Workspace context (from prior Mastra memory): ${parts.join(". ")}.`
    );
  } catch {
    return null;
  }
}
