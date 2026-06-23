import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { RenderAsset } from "@/lib/renderers/registry";
import { createInMemoryAsset } from "@/lib/assets/service";

describe("render smoke", () => {
  it("mounts document asset without error", () => {
    const asset = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "document",
      title: "Monthly Report",
      schema: { sections: [{ title: "Summary", type: "text" }] },
      data: { sections: [{ title: "Summary", body: "Revenue grew 12% in Q2." }] },
    });

    const { getByText } = render(<RenderAsset asset={asset} />);
    expect(getByText(/Revenue grew/)).toBeTruthy();
  });
});
