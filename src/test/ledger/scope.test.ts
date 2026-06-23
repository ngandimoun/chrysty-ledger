import { describe, expect, it } from "vitest";

import { getLedgerResourceId, normalizeScopeUserId } from "@/lib/ledger/scope";

describe("ledger scope identity", () => {
  const ledgerKey = "ledger_c6d501d0-b709-47a8-8552-02228069b7b0";

  it("does not treat anonymous ledger keys as Supabase user UUIDs", () => {
    expect(normalizeScopeUserId(ledgerKey, ledgerKey)).toBeNull();
    expect(normalizeScopeUserId(ledgerKey, ` ${ledgerKey} `)).toBeNull();
    expect(normalizeScopeUserId(ledgerKey, "ledger_other")).toBeNull();
  });

  it("keeps real auth user ids", () => {
    const userId = "294a8c57-6e10-4437-9e96-58f84353d2ad";
    expect(normalizeScopeUserId(ledgerKey, userId)).toBe(userId);
  });

  it("uses ledger key as mastra resource id when anonymous", () => {
    expect(getLedgerResourceId(ledgerKey, null)).toBe(ledgerKey);
    expect(getLedgerResourceId(ledgerKey, ledgerKey)).toBe(ledgerKey);
  });
});
