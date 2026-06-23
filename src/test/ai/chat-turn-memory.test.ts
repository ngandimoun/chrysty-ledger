import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { recordChatTurnMemory } from "@/lib/ai/chat-turn-memory";

const updateWorkingMemory = vi.fn();
const getWorkingMemory = vi.fn();

vi.mock("@/mastra/memory/ledger-memory", () => ({
  getLedgerMemory: vi.fn(() => ({
    getWorkingMemory,
    updateWorkingMemory,
  })),
}));

describe("recordChatTurnMemory", () => {
  beforeEach(() => {
    updateWorkingMemory.mockReset();
    getWorkingMemory.mockReset();
    getWorkingMemory.mockResolvedValue({
      recentAssets: [{ assetId: "asset-1", title: "Chart", kind: "chart", createdAt: "2024-01-01" }],
    });
  });

  it("persists last turn summary and asset ids", async () => {
    await recordChatTurnMemory({
      workspaceId: "ws-1",
      userId: "user-1",
      route: "chat",
      userInput: "viz spending",
      assistantSummary: "Here is your client spending chart.",
      attachmentNames: ["clients.png"],
      assetIds: ["asset-2"],
    });

    expect(updateWorkingMemory).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      vi.mocked(updateWorkingMemory).mock.calls[0]![0].workingMemory as string
    );

    expect(payload.lastTurn.summary).toContain("client spending chart");
    expect(payload.lastTurn.attachmentNames).toEqual(["clients.png"]);
    expect(payload.recentAssets[0].assetId).toBe("asset-2");
  });

  it("records search route metadata", async () => {
    await recordChatTurnMemory({
      workspaceId: "ws-1",
      userId: "user-1",
      route: "search",
      userInput: "competitor pricing",
      assistantSummary: "Found three pricing pages.",
      searchTopic: "competitor pricing",
    });

    const payload = JSON.parse(
      vi.mocked(updateWorkingMemory).mock.calls[0]![0].workingMemory as string
    );
    expect(payload.lastTurn.route).toBe("search");
    expect(payload.lastTurn.searchTopic).toBe("competitor pricing");
  });
});
