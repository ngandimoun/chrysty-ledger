export const LEDGER_KEY_STORAGE = "chrysty-ledger-key";
export const LEDGER_MIGRATED_FLAG = "chrysty-ledger-migrated";
export const WORKER_SLUG = process.env.NEXT_PUBLIC_WORKER_SLUG ?? "ledger";

export function getOrCreateLedgerKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = localStorage.getItem(LEDGER_KEY_STORAGE);
  if (existing) return existing;

  const key = `ledger_${crypto.randomUUID()}`;
  localStorage.setItem(LEDGER_KEY_STORAGE, key);
  return key;
}
