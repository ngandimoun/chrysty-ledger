import { task } from "@trigger.dev/sdk";

export const ledgerInvoiceTask = task({
  id: "ledger-invoice",
  run: async (payload: { workspaceId: string; invoiceId: string }) => {
    return {
      workspaceId: payload.workspaceId,
      invoiceId: payload.invoiceId,
      status: "generated",
      generatedAt: new Date().toISOString(),
    };
  },
});
