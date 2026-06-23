import { describe, expect, it, vi, beforeEach } from "vitest";

import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import { validateAndNormalizeAsset } from "@/lib/assets/validation/gate";

vi.mock("@/lib/ai/tool-registry", () => ({
  loadOfficialToolRegistry: vi.fn(async () => ({
    tools: [],
    toolToUri: new Map(),
    webSearchMode: "off",
    formulaUris: [],
  })),
}));

vi.mock("@/lib/ai/tool-loop", () => ({
  runOfficialToolLoop: vi.fn(),
}));

import { runOfficialToolLoop } from "@/lib/ai/tool-loop";

describe("kimi-tool-runner", () => {
  beforeEach(() => {
    vi.mocked(runOfficialToolLoop).mockReset();
  });

  it("parses assets array and validates definitions", async () => {
    vi.mocked(runOfficialToolLoop).mockResolvedValue({
      messages: [],
      result: {
        content: JSON.stringify({
          assets: [
            {
              kind: "table",
              subtype: "transactions",
              title: "Q1 Expenses",
              schema: {
                columns: [
                  { key: "date", label: "Date", type: "date" },
                  { key: "amount", label: "Amount", type: "currency" },
                ],
              },
              data: {
                rows: [{ date: "2025-01-01", amount: 42 }],
              },
            },
          ],
        }),
        reasoningContent: null,
        finishReason: "stop",
        rawMessage: null,
        usage: null,
      },
      toolCallsExecuted: [{ name: "excel", success: true }],
      searchContentTokens: null,
    });

    const result = await runKimiStructuredExtraction({
      workspaceId: "ws-1",
      userInput: "Extract transactions",
      enabledTools: ["excel", "date"],
      mode: "import",
    });

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]?.kind).toBe("table");
    expect(result.toolCallsExecuted.some((t) => t.name === "excel")).toBe(true);
  });

  it("retries once when validation fails", async () => {
    vi.mocked(runOfficialToolLoop)
      .mockResolvedValueOnce({
        messages: [],
        result: {
          content: JSON.stringify({
            assets: [{ kind: "table", title: "Bad", schema: { columns: [] }, data: { rows: [] } }],
          }),
          reasoningContent: null,
          finishReason: "stop",
          rawMessage: null,
          usage: null,
        },
        toolCallsExecuted: [],
        searchContentTokens: null,
      })
      .mockResolvedValueOnce({
        messages: [],
        result: {
          content: JSON.stringify({
            assets: [
              {
                kind: "table",
                title: "Fixed",
                schema: { columns: [{ key: "a", label: "A", type: "text" }] },
                data: { rows: [{ a: "1" }] },
              },
            ],
          }),
          reasoningContent: null,
          finishReason: "stop",
          rawMessage: null,
          usage: null,
        },
        toolCallsExecuted: [],
        searchContentTokens: null,
      });

    const result = await runKimiStructuredExtraction({
      workspaceId: "ws-1",
      userInput: "Fix table",
      enabledTools: ["excel"],
      mode: "import",
    });

    expect(runOfficialToolLoop).toHaveBeenCalledTimes(2);
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]?.title).toBe("Fixed");
  });

  it("validation gate rejects empty columns before save", () => {
    const validated = validateAndNormalizeAsset({
      workspaceId: "ws-1",
      kind: "table",
      title: "Bad",
      schema: { columns: [] },
      data: { rows: [] },
    });
    expect(validated.ok).toBe(false);
  });
});
