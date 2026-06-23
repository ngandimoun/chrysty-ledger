import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/agent-actions/kimi-tool-runner", () => ({
  runKimiStructuredExtraction: vi.fn(),
}));

vi.mock("@/lib/assets/service", () => ({
  createAssetV2: vi.fn(async (_scope, def) => ({
    asset: {
      id: "new-asset",
      workspaceId: def.workspaceId,
      kind: def.kind,
      title: def.title,
      schema: def.schema ?? {},
      data: def.data ?? {},
      relations: [],
      metadata: {},
      version: 1,
      creationSequence: 1,
      createdAt: "",
      updatedAt: "",
    },
  })),
  getAssetV2: vi.fn(async () => ({
    id: "source-1",
    workspaceId: "ws-1",
    kind: "table",
    title: "Sales",
    schema: { columns: [{ key: "amount", label: "Amount", type: "currency" }] },
    data: { rows: [{ amount: 100 }] },
    relations: [],
    metadata: {},
    version: 1,
    creationSequence: 1,
    createdAt: "",
    updatedAt: "",
  })),
  linkAssetsV2: vi.fn(),
  createProjectV2: vi.fn(),
  listAssetsV2: vi.fn(),
  searchAssetsV2: vi.fn(),
  updateAssetV2: vi.fn(),
  archiveAssetV2: vi.fn(),
}));

import { executeActionPlan } from "@/lib/agent-actions/executor";
import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import type { ActionContext } from "@/lib/agent-actions/types";

describe("executor transform", () => {
  beforeEach(() => {
    vi.mocked(runKimiStructuredExtraction).mockReset();
  });

  it("runs Kimi tools for transform steps", async () => {
    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [
        {
          workspaceId: "ws-1",
          kind: "dashboard",
          subtype: "cashflow",
          title: "Cashflow",
          schema: {
            widgets: [{ type: "metric", title: "Total", dataKey: "total" }],
          },
          data: { metrics: { total: 100 } },
        },
      ],
      toolCallsExecuted: [{ name: "code_runner", success: true }],
      errors: [],
    });

    const ctx: ActionContext = {
      workspaceId: "ws-1",
      userId: "user-1",
      ledgerKey: "key-1",
      userInput: "Build a cashflow dashboard",
      scope: { supabase: {} as never, ledgerKey: "key-1", userId: "user-1" },
      variables: { $prev: "source-1" },
    };

    const result = await executeActionPlan(
      {
        userFacingPhase: "Transforming…",
        actions: [
          {
            action: "transform",
            tools: ["code_runner"],
            inputs: { sourceVar: "$prev", targetKind: "dashboard", subtype: "cashflow" },
          },
        ],
      },
      ctx
    );

    expect(runKimiStructuredExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "transform",
        enabledTools: ["code_runner"],
        targetKind: "dashboard",
      })
    );
    expect(result.assets[0]?.kind).toBe("dashboard");
  });
});
