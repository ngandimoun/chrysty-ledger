import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import { shouldRouteToChat } from "@/lib/ai/orchestrator/action-routing";
import { createSseDonePayload, createSsePayload } from "@/lib/ai/streaming";
import { streamChatResponse } from "@/lib/chat-api-client";
import { WORKSPACE_STARTER_SUGGESTIONS } from "@/lib/workspace-overview";

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200 });
}

describe("streamChatResponse", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses content deltas and final replies", async () => {
    const replies = [
      {
        id: "reply-1",
        role: "assistant" as const,
        type: "text" as const,
        content: "Hello from assistant",
        createdAt: "2024-06-01T10:00:00.000Z",
      },
    ];

    vi.mocked(fetch).mockResolvedValue(
      createSseResponse([
        createSsePayload({ type: "content", delta: "Hello" }),
        createSsePayload({ type: "replies", replies }),
        createSseDonePayload(),
      ])
    );

    const result = await streamChatResponse(new FormData());
    expect(result.replies).toEqual(replies);
    expect(result.aborted).toBe(false);
  });

  it("propagates SSE error messages", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSseResponse([
        createSsePayload({ type: "content", delta: "Partial reply" }),
        createSsePayload({ type: "error", message: "Chat request failed." }),
        createSseDonePayload(),
      ])
    );

    await expect(streamChatResponse(new FormData())).rejects.toThrow("Chat request failed.");
  });
});

describe("shouldRouteToChat", () => {
  it("routes invoice create prompts without attachments to chat", () => {
    const useChat = shouldRouteToChat({
      actions: [
        {
          action: "create",
          inputs: {
            kind: "document",
            subtype: "invoice",
            title: "New Invoice",
            schema: { sections: [{ title: "Invoice", type: "text" }] },
            data: { sections: [{ title: "Invoice", body: "" }] },
          },
        },
      ],
      attachmentCount: 0,
      attachmentTypes: [],
      assetCount: 0,
      mode: "default",
    });

    expect(useChat).toBe(true);
  });

  it("routes import plans with file-only attachments to executor", () => {
    const useChat = shouldRouteToChat({
      actions: [{ action: "import", inputs: { useAttachments: true } }],
      attachmentCount: 1,
      attachmentTypes: ["application/pdf"],
      assetCount: 0,
      mode: "default",
    });

    expect(useChat).toBe(false);
  });

  it("routes image-only attachments to chat even with import plan", () => {
    const useChat = shouldRouteToChat({
      actions: [{ action: "import", inputs: { useAttachments: true } }],
      attachmentCount: 1,
      attachmentTypes: ["image/png"],
      assetCount: 0,
      mode: "default",
    });

    expect(useChat).toBe(true);
  });

  it("routes mixed file and image attachments to chat", () => {
    const useChat = shouldRouteToChat({
      actions: [{ action: "import", inputs: { useAttachments: true } }],
      attachmentCount: 2,
      attachmentTypes: ["text/csv", "image/png"],
      assetCount: 0,
      mode: "default",
    });

    expect(useChat).toBe(true);
  });

  it("routes conversational plans to chat", () => {
    const useChat = shouldRouteToChat({
      actions: [{ action: "create", inputs: { conversational: true } }],
      attachmentCount: 0,
      attachmentTypes: [],
      assetCount: 0,
      mode: "default",
    });

    expect(useChat).toBe(true);
  });
});

describe("WorkspaceOverview suggestions", () => {
  it("fires onSuggestionClick for starter chips", () => {
    const onSuggestionClick = vi.fn();

    render(
      <WorkspaceOverview
        workspaceName="Bakery Business"
        assets={[]}
        onSuggestionClick={onSuggestionClick}
      />
    );

    const invoiceChip = WORKSPACE_STARTER_SUGGESTIONS.find(
      (chip) => chip.id === "create-invoice"
    );
    expect(invoiceChip).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: invoiceChip!.label }));
    expect(onSuggestionClick).toHaveBeenCalledWith(invoiceChip!.prompt);
  });
});
