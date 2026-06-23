import { describe, expect, it } from "vitest";

import {
  buildColumnDefs,
  coerceTableColumns,
  normalizeTableRows,
} from "@/lib/renderers/table-utils";

describe("TableRenderer utils", () => {
  const columns = [
    { key: "a", label: "A", type: "text" as const },
    { key: "b", label: "B", type: "number" as const },
  ];

  it("builds column defs from schema", () => {
    const defs = buildColumnDefs(columns);
    expect(defs).toHaveLength(2);
    expect(defs[0]?.field).toBe("a");
  });

  it("pads missing row keys", () => {
    const rows = normalizeTableRows(columns, [{ a: "x" }]);
    expect(rows[0]).toEqual({ a: "x", b: "" });
  });

  it("handles empty columns without throwing", () => {
    expect(buildColumnDefs([])).toEqual([]);
    expect(normalizeTableRows([], [{ a: 1 }])).toEqual([{}]);
  });

  it("coerces legacy string columns and ag-grid-style defs", () => {
    expect(coerceTableColumns(["Category", "Amount (₹)"])).toEqual([
      { key: "Category", label: "Category", type: "text" },
      { key: "Amount (₹)", label: "Amount (₹)", type: "text" },
    ]);
    expect(
      coerceTableColumns([{ field: "total", headerName: "Total (₹)", type: "currency" }])
    ).toEqual([{ key: "total", label: "Total (₹)", type: "currency" }]);
  });

  it("strips markdown from string cell values on display", () => {
    const rows = normalizeTableRows(
      [{ key: "category", label: "Category", type: "text" }],
      [{ category: "**Grand Total**" }]
    );
    expect(rows[0]?.category).toBe("Grand Total");
  });
});
