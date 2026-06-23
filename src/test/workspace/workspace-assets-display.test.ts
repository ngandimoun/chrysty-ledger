import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/lib/chat-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import {
  groupAssetsByKind,
  mergeChatUploadsIntoAssets,
  sortDisplayAssets,
} from "@/lib/workspace-assets";

function makeAsset(overrides: Partial<WorkspaceAsset> & Pick<WorkspaceAsset, "id" | "title">): WorkspaceAsset {
  return {
    workspaceId: "ws-1",
    category: "sheet",
    kind: "table",
    payload: {
      id: overrides.id,
      kind: "table",
      title: overrides.title,
      columns: [],
      rows: [],
    },
    sourceMessageId: undefined,
    creationSequence: 1,
    version: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortDisplayAssets", () => {
  it("keeps all assets with the same title and kind", () => {
    const sorted = sortDisplayAssets([
      makeAsset({ id: "a-old", title: "Payment status", creationSequence: 1 }),
      makeAsset({ id: "a-new", title: "Payment status", creationSequence: 2 }),
    ]);

    expect(sorted).toHaveLength(2);
    expect(sorted[0]?.id).toBe("a-new");
    expect(sorted[1]?.id).toBe("a-old");
  });
});

describe("groupAssetsByKind uploads", () => {
  it("groups file and file-list assets under Uploads", () => {
    const groups = groupAssetsByKind([
      makeAsset({
        id: "upload-1",
        title: "receipt.png",
        kind: "file-list",
        category: "files",
        payload: {
          id: "upload-1",
          kind: "file-list",
          title: "receipt.png",
          files: [{ name: "receipt.png", size: "1 KB" }],
        },
      }),
      makeAsset({
        id: "upload-2",
        title: "invoice.pdf",
        kind: "file",
        category: "files",
        payload: {
          id: "upload-2",
          kind: "file-list",
          title: "invoice.pdf",
          files: [{ name: "invoice.pdf", size: "2 KB" }],
        },
      }),
      makeAsset({ id: "table-1", title: "Summary", kind: "table" }),
    ]);

    const uploads = groups.find((group) => group.label === "Uploads");
    expect(uploads?.assets).toHaveLength(2);
    expect(groups[0]?.label).toBe("Uploads");
    expect(groups.find((group) => group.label === "Table")?.assets).toHaveLength(1);
  });
});

describe("mergeChatUploadsIntoAssets", () => {
  it("surfaces chat message files that are not yet in ledger_assets", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "user",
        type: "text",
        content: "analyze this",
        createdAt: "2024-06-23T15:05:00.000Z",
        files: [
          {
            name: "ChatGPT Image Jun 23, 2026, 03_05_16 PM.png",
            size: 2048,
            type: "image/png",
          },
        ],
      },
    ];

    const merged = sortDisplayAssets(
      mergeChatUploadsIntoAssets("ws-1", [], messages)
    );
    const groups = groupAssetsByKind(merged);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toContain("ChatGPT Image Jun 23");
    expect(groups[0]?.label).toBe("Uploads");
    expect(groups[0]?.assets).toHaveLength(1);
  });

  it("does not duplicate uploads already loaded from ledger_assets", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "user",
        type: "text",
        content: "analyze this",
        createdAt: "2024-06-23T15:05:00.000Z",
        files: [
          {
            name: "receipt.png",
            size: 2048,
            type: "image/png",
            assetId: "file-1",
          },
        ],
      },
    ];

    const merged = mergeChatUploadsIntoAssets("ws-1", [
      makeAsset({
        id: "file-1",
        title: "receipt.png",
        kind: "file-list",
        category: "files",
        sourceMessageId: "msg-1",
        payload: {
          id: "file-1",
          kind: "file-list",
          title: "receipt.png",
          files: [{ name: "receipt.png", size: "2.0 KB" }],
        },
      }),
    ], messages);

    expect(merged).toHaveLength(1);
  });
});
