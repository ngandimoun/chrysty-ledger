import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ChatMarkdown } from "@/components/workspace/chat-markdown";

describe("ChatMarkdown", () => {
  it("renders bold text instead of literal asterisks", () => {
    const { container } = render(<ChatMarkdown content="**Client** name required" />);
    const strong = within(container).getByText("Client");
    expect(strong.tagName).toBe("STRONG");
    expect(within(container).queryByText("**Client**")).toBeNull();
  });

  it("renders bullet list items", () => {
    const { container } = render(<ChatMarkdown content={"- Upload receipts\n- Create invoice"} />);
    expect(within(container).getByText("Upload receipts")).toBeTruthy();
    expect(within(container).getByText("Create invoice")).toBeTruthy();
    expect(container.querySelector("ul")).toBeTruthy();
  });

  it("renders GFM tables with headers", () => {
    const { container } = render(
      <ChatMarkdown
        content={`| Field | Value |
| --- | --- |
| Client | Acme |`}
      />
    );
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(within(table as HTMLElement).getByText("Field")).toBeTruthy();
    expect(within(table as HTMLElement).getByText("Client")).toBeTruthy();
    expect(within(table as HTMLElement).getByText("Acme")).toBeTruthy();
  });
});
