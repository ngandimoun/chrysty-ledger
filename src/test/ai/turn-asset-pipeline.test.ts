import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { maybeCreateAssetsFromTurn } from "@/lib/ai/orchestrator/turn-asset-pipeline";
import type { LedgerScope } from "@/lib/ledger/scope";

vi.mock("@/lib/agent-actions/kimi-tool-runner", () => ({
  runKimiStructuredExtraction: vi.fn(),
}));

vi.mock("@/lib/assets/service", () => ({
  createAssetV2: vi.fn(),
  updateAssetV2: vi.fn(),
  getAssetV2: vi.fn(),
  listAssetsV2: vi.fn(),
}));

import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import { createAssetV2, getAssetV2, listAssetsV2, updateAssetV2 } from "@/lib/assets/service";

const mockScope = {
  supabase: {},
  ledgerKey: "ledger-1",
  userId: "user-1",
} as LedgerScope;

const chartDefinition = {
  workspaceId: "ws-1",
  kind: "chart",
  title: "Client spending",
  schema: {
    intent: "compare_categories",
    title: "Client spending",
  },
  data: {
    series: [{ label: "A", value: 100 }],
  },
};

const ROHIT_ANALYSIS = `Spending Breakdown by Category
Category	Amount	% of Total
Room Rent	₹1,800	64.7%
Food & Beverages	₹550	19.8%
Transport	₹350	12.6%`;

describe("maybeCreateAssetsFromTurn", () => {
  beforeEach(() => {
    vi.mocked(runKimiStructuredExtraction).mockReset();
    vi.mocked(createAssetV2).mockReset();
    vi.mocked(updateAssetV2).mockReset();
    vi.mocked(getAssetV2).mockReset();
    vi.mocked(listAssetsV2).mockReset();
    vi.mocked(listAssetsV2).mockResolvedValue([]);
  });

  it("creates assets and emits asset_created", async () => {
    const onEvent = vi.fn();

    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [chartDefinition],
      toolCallsExecuted: [],
      errors: [],
    });

    vi.mocked(createAssetV2).mockResolvedValue({
      asset: {
        id: "asset-new",
        workspaceId: "ws-1",
        projectId: null,
        kind: "chart",
        subtype: null,
        title: "Client spending",
        schema: chartDefinition.schema,
        data: chartDefinition.data,
        relations: [],
        metadata: {},
        version: 1,
        creationSequence: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        archivedAt: null,
      },
    });

    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "viz my clients",
      chatText: "Spending by client is shown below.",
      attachments: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      visionInputs: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      fileSystemMessages: [],
      appHistory: [],
      onEvent,
    });

    expect(result.assets).toHaveLength(1);
    expect(result.skipped).toBe(false);
    expect(createAssetV2).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "asset_created",
      asset: expect.objectContaining({ id: "asset-new" }),
    });
  });

  it("falls back to chat analysis parser when extraction returns no definitions", async () => {
    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [],
      toolCallsExecuted: [],
      errors: ["No asset definitions in model response"],
    });

    vi.mocked(createAssetV2).mockImplementation(async (_scope, def) => ({
      asset: {
        id: "asset-parsed",
        workspaceId: "ws-1",
        projectId: null,
        kind: def.kind,
        subtype: def.subtype ?? null,
        title: def.title,
        schema: def.schema ?? {},
        data: def.data ?? {},
        relations: [],
        metadata: {},
        version: 1,
        creationSequence: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        archivedAt: null,
      },
    }));

    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "do the viz of my clients spending",
      chatText: ROHIT_ANALYSIS,
      attachments: [],
      visionInputs: [],
      fileSystemMessages: [],
      appHistory: [],
    });

    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.skipped).toBe(false);
    expect(createAssetV2).toHaveBeenCalled();
  });

  it("updates the recent asset on revision prompts", async () => {
    const onEvent = vi.fn();

    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [chartDefinition],
      toolCallsExecuted: [],
      errors: [],
    });

    vi.mocked(updateAssetV2).mockResolvedValue({
      asset: {
        id: "asset-1",
        workspaceId: "ws-1",
        projectId: null,
        kind: "chart",
        subtype: null,
        title: "Client spending",
        schema: chartDefinition.schema,
        data: chartDefinition.data,
        relations: [],
        metadata: {},
        version: 2,
        creationSequence: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        archivedAt: null,
      },
    });

    vi.mocked(getAssetV2).mockResolvedValue({
      id: "asset-1",
      workspaceId: "ws-1",
      projectId: null,
      kind: "chart",
      subtype: null,
      title: "Client spending",
      schema: chartDefinition.schema,
      data: { series: [{ label: "A", value: 50 }] },
      relations: [],
      metadata: {},
      version: 1,
      creationSequence: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      archivedAt: null,
    });

    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "update this chart with the new totals",
      chatText: "Updated totals applied.",
      attachments: [{ buffer: Buffer.from(""), filename: "b.png", mimeType: "image/png" }],
      visionInputs: [{ buffer: Buffer.from(""), filename: "b.png", mimeType: "image/png" }],
      fileSystemMessages: [],
      appHistory: [],
      memoryRecord: {
        recentAssets: [
          {
            assetId: "asset-1",
            title: "Client spending",
            kind: "chart",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      onEvent,
    });

    expect(result.assets).toHaveLength(1);
    expect(updateAssetV2).toHaveBeenCalledWith(
      mockScope,
      "ws-1",
      "asset-1",
      expect.objectContaining({ title: "Client spending" })
    );
    expect(createAssetV2).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith({
      type: "asset_updated",
      asset: expect.objectContaining({ id: "asset-1", version: 2 }),
    });
  });

  it("skips asset creation for text-only requests", async () => {
    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "just explain this image, don't save",
      chatText: "This is a bar chart.",
      attachments: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      visionInputs: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      fileSystemMessages: [],
      appHistory: [],
    });

    expect(result.assets).toEqual([]);
    expect(result.attempted).toBe(false);
    expect(runKimiStructuredExtraction).not.toHaveBeenCalled();
  });

  it("marks skipped when pipeline attempts but nothing is saved", async () => {
    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [],
      toolCallsExecuted: [],
      errors: [],
    });

    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "viz spending",
      chatText: "No tables here.",
      attachments: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      visionInputs: [{ buffer: Buffer.from(""), filename: "a.png", mimeType: "image/png" }],
      fileSystemMessages: [],
      appHistory: [],
    });

    expect(result.assets).toEqual([]);
    expect(result.attempted).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("creates chart from prior assistant analysis on follow-up viz", async () => {
    vi.mocked(runKimiStructuredExtraction).mockResolvedValue({
      definitions: [],
      toolCallsExecuted: [],
      errors: [],
    });

    vi.mocked(createAssetV2).mockImplementation(async (_scope, def) => ({
      asset: {
        id: "asset-follow-up",
        workspaceId: "ws-1",
        projectId: null,
        kind: def.kind,
        subtype: def.subtype ?? null,
        title: def.title,
        schema: def.schema ?? {},
        data: def.data ?? {},
        relations: [],
        metadata: {},
        version: 1,
        creationSequence: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        archivedAt: null,
      },
    }));

    const appHistory = [
      {
        id: "u1",
        role: "user" as const,
        type: "text" as const,
        content: "viz client spending",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "a1",
        role: "assistant" as const,
        type: "text" as const,
        content: ROHIT_ANALYSIS,
        createdAt: "2024-01-01T00:00:01.000Z",
      },
    ];

    const result = await maybeCreateAssetsFromTurn({
      workspaceId: "ws-1",
      scope: mockScope,
      userInput: "do the viz of this expense",
      chatText: "I don't have access to any expense file.",
      attachments: [],
      visionInputs: [],
      fileSystemMessages: [],
      appHistory,
    });

    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.skipped).toBe(false);
    expect(createAssetV2).toHaveBeenCalled();
  });
});
