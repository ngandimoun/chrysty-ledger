import { describe, expect, it } from "vitest";

import {
  buildFollowUpContext,
  getLastAssistantText,
  getLastUserMessageWithFiles,
  referencesPriorTurn,
} from "@/lib/ai/conversation-context";
import type { ChatMessage, FileRef } from "@/lib/chat-types";

const ROHIT_ANALYSIS = `Spending Breakdown by Category
Category	Amount	% of Total
Room Rent	₹1,800	64.7%
Food & Beverages	₹550	19.8%
Transport	₹350	12.6%`;

function assistantText(content: string): ChatMessage {
  return {
    id: "a1",
    role: "assistant",
    type: "text",
    content,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

function userText(content: string, files?: FileRef[]): ChatMessage {
  return {
    id: "u1",
    role: "user",
    type: "text",
    content,
    files,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("referencesPriorTurn", () => {
  it("detects follow-up phrasing", () => {
    expect(referencesPriorTurn("do the viz of this expense")).toBe(true);
    expect(referencesPriorTurn("chart that data")).toBe(true);
    expect(referencesPriorTurn("same expense sheet please")).toBe(true);
    expect(referencesPriorTurn("create a new chart from scratch")).toBe(false);
  });
});

describe("getLastAssistantText", () => {
  it("returns the latest assistant text message", () => {
    const history: ChatMessage[] = [
      userText("viz client spending"),
      assistantText(ROHIT_ANALYSIS),
      userText("do the viz of this expense"),
    ];

    expect(getLastAssistantText(history)).toBe(ROHIT_ANALYSIS);
  });
});

describe("getLastUserMessageWithFiles", () => {
  it("returns the latest user message with attachments", () => {
    const history: ChatMessage[] = [
      userText("viz client spending", [{ name: "expense.png", type: "image/png", size: 100 }]),
      assistantText(ROHIT_ANALYSIS),
      userText("do the viz of this expense"),
    ];

    const prior = getLastUserMessageWithFiles(history);
    expect(prior?.files).toHaveLength(1);
    expect(prior?.files?.[0]?.name).toBe("expense.png");
  });
});

describe("buildFollowUpContext", () => {
  it("includes prior analysis for deictic follow-ups", () => {
    const context = buildFollowUpContext({
      userInput: "do the viz of this expense",
      appHistory: [userText("viz spending"), assistantText(ROHIT_ANALYSIS)],
    });

    expect(context).toContain("continuing a prior conversation");
    expect(context).toContain("Room Rent");
    expect(context).toContain("never ask the user to re-upload");
    expect(context).toContain("workspace canvas");
  });

  it("returns null when the user is not referencing a prior turn", () => {
    const context = buildFollowUpContext({
      userInput: "hello",
      appHistory: [assistantText(ROHIT_ANALYSIS)],
    });

    expect(context).toBeNull();
  });
});
