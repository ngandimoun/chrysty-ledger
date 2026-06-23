import { describe, expect, it } from "vitest";

import { chatMessageToKimiMessage } from "@/lib/ai/messages";
import type { ChatMessage } from "@/lib/chat-types";

describe("chatMessageToKimiMessage", () => {
  it("includes attachment names on user messages", () => {
    const message: ChatMessage = {
      id: "u1",
      role: "user",
      type: "text",
      content: "viz client spending",
      files: [{ name: "expense.png", type: "image/png", size: 1200 }],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const kimi = chatMessageToKimiMessage(message);
    expect(kimi?.role).toBe("user");
    expect(kimi?.content).toContain("expense.png");
  });

  it("includes referenced asset titles on user messages", () => {
    const message: ChatMessage = {
      id: "u2",
      role: "user",
      type: "text",
      content: "compare these",
      assetRefs: [{ id: "asset-1", title: "Spending table", kind: "table", category: "sheet" }],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const kimi = chatMessageToKimiMessage(message);
    expect(kimi?.content).toContain("Spending table");
    expect(kimi?.content).toContain("Referenced assets");
  });

  it("maps artifact messages to a short assistant summary", () => {
    const message: ChatMessage = {
      id: "a1",
      role: "assistant",
      type: "artifact",
      summary: "Spending by category",
      artifact: {
        id: "art-1",
        kind: "chart",
        title: "Client spending",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const kimi = chatMessageToKimiMessage(message);
    expect(kimi?.role).toBe("assistant");
    expect(kimi?.content).toContain("Created chart: Client spending");
    expect(kimi?.content).toContain("Spending by category");
  });

  it("maps created messages with asset titles", () => {
    const message: ChatMessage = {
      id: "a2",
      role: "assistant",
      type: "created",
      content: "Created assets",
      assets: [{ id: "asset-1", title: "Client spending" }],
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const kimi = chatMessageToKimiMessage(message);
    expect(kimi?.content).toContain("Client spending");
  });
});
