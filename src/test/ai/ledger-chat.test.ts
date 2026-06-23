import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAssistantRepliesFromLedgerChat } from "@/lib/ai/ledger-chat";
import type { Asset } from "@/lib/assets/asset";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    workspaceId: "ws-1",
    kind: "chart",
    subtype: "spending",
    title: "Cash flow by category",
    schema: { intent: "compare_categories", title: "Cash flow by category" },
    data: { series: [{ label: "Inflow", value: 100 }] },
    metadata: {},
    relations: [],
    version: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    creationSequence: 1,
    ...overrides,
  };
}

describe("buildAssistantRepliesFromLedgerChat", () => {
  it("emits one artifact reply per saved asset without duplicate created/updated bubbles", () => {
    const replies = buildAssistantRepliesFromLedgerChat({
      text: "Here is your cash flow breakdown.",
      assets: [makeAsset(), makeAsset({ id: "asset-2", title: "Cash flow summary", kind: "table" })],
      toolCallsExecuted: [],
      searchContentTokens: null,
    });

    const artifactReplies = replies.filter((reply) => reply.type === "artifact");
    const lifecycleReplies = replies.filter(
      (reply) => reply.type === "created" || reply.type === "updated"
    );

    expect(artifactReplies).toHaveLength(2);
    expect(lifecycleReplies).toHaveLength(0);
    expect(replies.some((reply) => reply.type === "text")).toBe(true);
  });
});
