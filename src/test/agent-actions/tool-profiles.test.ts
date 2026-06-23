import { describe, expect, it, vi } from "vitest";

import {
  inferToolsForAnalyze,
  inferToolsForImport,
  inferToolsForTransform,
  resolveToolsForStep,
} from "@/lib/agent-actions/tool-profiles";
import type { AttachmentInput } from "@/lib/ai/types";

describe("agent-actions tool-profiles", () => {
  it("infers excel for spreadsheet uploads", () => {
    const attachments: AttachmentInput[] = [
      {
        filename: "2025-finances.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from(""),
      },
    ];
    expect(inferToolsForImport(attachments)).toContain("excel");
  });

  it("infers code_runner for transform", () => {
    expect(inferToolsForTransform({
      id: "1",
      workspaceId: "ws",
      kind: "table",
      title: "Sales",
      schema: {},
      data: {},
      relations: [],
      metadata: {},
      version: 1,
      creationSequence: 1,
      createdAt: "",
      updatedAt: "",
    })).toContain("code_runner");
  });

  it("infers code_runner for table analysis", () => {
    const tools = inferToolsForAnalyze([
      {
        id: "1",
        workspaceId: "ws",
        kind: "table",
        title: "Sales",
        schema: {},
        data: {},
        relations: [],
        metadata: {},
        version: 1,
        creationSequence: 1,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(tools).toContain("code_runner");
    expect(tools).toContain("excel");
  });

  it("prefers explicit planner tools", () => {
    const tools = resolveToolsForStep("import", {
      stepTools: ["quickjs"],
      attachments: [],
    });
    expect(tools).toEqual(["quickjs"]);
  });
});
