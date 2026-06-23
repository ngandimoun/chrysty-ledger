import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/attachment-routing", () => ({
  withMoonshotFileSession: vi.fn(async (_attachments, fn) =>
    fn({
      fileSystemMessages: [{ role: "system", content: "extracted file text" }],
      visionInputs: [],
      uploadedFileIds: ["file-123"],
    })
  ),
}));

vi.mock("@/lib/agent-actions/kimi-tool-runner", () => ({
  runKimiStructuredExtraction: vi.fn(),
}));

vi.mock("@/lib/assets/service", () => ({
  createAssetV2: vi.fn(async () => ({
    asset: {
      id: "asset-1",
      workspaceId: "ws-1",
      kind: "table",
      title: "Imported",
      schema: {},
      data: {},
      relations: [],
      metadata: {},
      version: 1,
      creationSequence: 1,
      createdAt: "",
      updatedAt: "",
    },
  })),
  createProjectV2: vi.fn(),
  getAssetV2: vi.fn(),
  linkAssetsV2: vi.fn(),
  listAssetsV2: vi.fn(),
  searchAssetsV2: vi.fn(),
  updateAssetV2: vi.fn(),
  archiveAssetV2: vi.fn(),
}));

import { executeActionPlan } from "@/lib/agent-actions/executor";
import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import type { ActionContext } from "@/lib/agent-actions/types";

describe("executor import", () => {
  beforeEach(() => {
    vi.mocked(runKimiStructuredExtraction).mockReset();
  });

  it("uses Kimi structured extraction instead of Buffer.toString", async () => {
    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [
        {
          workspaceId: "ws-1",
          kind: "table",
          title: "Transactions",
          schema: {
            columns: [{ key: "vendor", label: "Vendor", type: "text" }],
          },
          data: { rows: [{ vendor: "Amazon" }] },
        },
      ],
      toolCallsExecuted: [{ name: "excel", success: true }],
      errors: [],
    });

    const ctx: ActionContext = {
      workspaceId: "ws-1",
      userId: "user-1",
      ledgerKey: "key-1",
      userInput: "Import my receipts",
      scope: { supabase: {} as never, ledgerKey: "key-1", userId: "user-1" },
      attachments: [
        {
          filename: "receipts.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4"),
        },
      ],
      variables: {},
    };

    await executeActionPlan(
      {
        userFacingPhase: "Importing…",
        actions: [{ action: "import", tools: ["excel", "date"], inputs: { useAttachments: true } }],
      },
      ctx
    );

    expect(runKimiStructuredExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "import",
        enabledTools: ["excel", "date"],
        fileSystemMessages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
        ]),
      })
    );
  });
});
