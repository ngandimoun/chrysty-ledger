import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Asset } from "@/lib/assets/asset";

const uploadWorkspaceFile = vi.fn();
const createAssetV2 = vi.fn();
const nextCreationSequence = vi.fn();

vi.mock("@/lib/storage/workspace-files", () => ({
  uploadWorkspaceFile: (...args: unknown[]) => uploadWorkspaceFile(...args),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/assets/service", () => ({
  createAssetV2: (...args: unknown[]) => createAssetV2(...args),
}));

vi.mock("@/lib/ledger/events", () => ({
  nextCreationSequence: (...args: unknown[]) => nextCreationSequence(...args),
}));

import { persistChatUploads } from "@/lib/assets/persist-chat-uploads";

describe("persistChatUploads", () => {
  const scope = { supabase: {} as never, ledgerKey: "ledger-1", userId: "user-1" };

  beforeEach(() => {
    uploadWorkspaceFile.mockReset();
    createAssetV2.mockReset();
    nextCreationSequence.mockReset();
    nextCreationSequence.mockResolvedValue(3);
  });

  it("creates one file asset per attachment with durable storage refs", async () => {
    uploadWorkspaceFile.mockResolvedValue({
      bucket: "ledger-uploads",
      path: "ledger-1/ws-1/asset-1/receipt.png",
      storageRef: "supabase://ledger-uploads/ledger-1/ws-1/asset-1/receipt.png",
    });

    const asset: Asset = {
      id: "asset-1",
      workspaceId: "ws-1",
      kind: "file",
      subtype: "upload",
      title: "receipt.png",
      schema: { filename: "receipt.png", mimeType: "image/png" },
      data: {
        storageRef: "supabase://ledger-uploads/ledger-1/ws-1/asset-1/receipt.png",
        size: 10,
      },
      relations: [],
      metadata: { mimeType: "image/png" },
      version: 1,
      creationSequence: 3,
      sourceMessageId: "msg-1",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    createAssetV2.mockResolvedValue({ asset });

    const events: Array<{ type: string; asset: Asset }> = [];
    const attachments = [
      {
        filename: "receipt.png",
        mimeType: "image/png",
        buffer: Buffer.from("fake-image"),
      },
    ];

    const assets = await persistChatUploads({
      scope,
      workspaceId: "ws-1",
      attachments,
      sourceMessageId: "msg-1",
      onEvent: (event) => {
        if (event.type === "asset_created") {
          events.push(event);
        }
      },
    });

    expect(uploadWorkspaceFile).toHaveBeenCalledTimes(1);
    expect(createAssetV2).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        workspaceId: "ws-1",
        kind: "file",
        subtype: "upload",
        title: "receipt.png",
        sourceMessageId: "msg-1",
        creationSequence: 3,
        data: expect.objectContaining({
          storageRef: "supabase://ledger-uploads/ledger-1/ws-1/asset-1/receipt.png",
          size: 10,
        }),
      })
    );
    expect(assets).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.asset.id).toBe("asset-1");
  });

  it("continues when an upload fails", async () => {
    uploadWorkspaceFile
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValueOnce({
        bucket: "ledger-uploads",
        path: "ledger-1/ws-1/asset-2/notes.pdf",
        storageRef: "supabase://ledger-uploads/ledger-1/ws-1/asset-2/notes.pdf",
      });

    createAssetV2.mockResolvedValue({
      asset: {
        id: "asset-2",
        workspaceId: "ws-1",
        kind: "file",
        subtype: "upload",
        title: "notes.pdf",
        schema: { filename: "notes.pdf", mimeType: "application/pdf" },
        data: {
          storageRef: "supabase://ledger-uploads/ledger-1/ws-1/asset-2/notes.pdf",
          size: 4,
        },
        relations: [],
        metadata: {},
        version: 1,
        creationSequence: 4,
        createdAt: "",
        updatedAt: "",
      },
    });

    const assets = await persistChatUploads({
      scope,
      workspaceId: "ws-1",
      attachments: [
        { filename: "broken.png", mimeType: "image/png", buffer: Buffer.from("x") },
        { filename: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") },
      ],
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]?.title).toBe("notes.pdf");
  });
});
