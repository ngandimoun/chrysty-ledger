export const AI_KIND_TEMPLATES: Record<string, { schema: Record<string, unknown>; data: Record<string, unknown> }> = {
  table: {
    schema: {
      columns: [
        { key: "name", label: "Name", type: "text" },
        { key: "amount", label: "Amount", type: "currency" },
      ],
    },
    data: { rows: [] },
  },
  chart: {
    schema: { intent: "compare_categories", title: "Chart" },
    data: { series: [{ label: "A", value: 0 }] },
  },
  dashboard: {
    schema: {
      widgets: [
        { type: "metric", title: "Total", dataKey: "total" },
        { type: "viz", intent: "compare_categories", title: "Breakdown" },
      ],
    },
    data: { metrics: { total: 0 } },
  },
  document: {
    schema: { sections: [{ title: "Summary", type: "text" }] },
    data: { sections: [{ title: "Summary", body: "" }] },
  },
  file: {
    schema: { filename: "upload.bin", mimeType: "application/octet-stream" },
    data: { storageRef: "pending://upload" },
  },
};
