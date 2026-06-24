"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getOrCreateLedgerKey } from "@/lib/ledger/identity";
import { claimLedgerWorkspaces } from "@/lib/ledger/workspaces";
import type { LedgerScope } from "@/lib/ledger/scope";
import { getBrowserClient } from "@/lib/supabase/client";

type LedgerContextValue = {
  supabase: ReturnType<typeof getBrowserClient>;
  ledgerKey: string;
  userId: string | null;
  scope: LedgerScope | null;
  isReady: boolean;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ledgerKey, setLedgerKey] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const supabase = useMemo(() => getBrowserClient(), []);

  useEffect(() => {
    setLedgerKey(getOrCreateLedgerKey());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user.id ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      setUserId(nextUserId);

      if (_event === "SIGNED_IN" && nextUserId && ledgerKey) {
        void claimLedgerWorkspaces(
          { supabase, ledgerKey, userId: nextUserId },
          nextUserId
        );
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isReady, ledgerKey, supabase]);

  const scope = useMemo<LedgerScope | null>(() => {
    if (!isReady || !ledgerKey) return null;
    return { supabase, ledgerKey, userId };
  }, [isReady, ledgerKey, supabase, userId]);

  const value = useMemo(
    () => ({
      supabase,
      ledgerKey,
      userId,
      scope,
      isReady,
    }),
    [supabase, ledgerKey, userId, scope, isReady]
  );

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error("useLedger must be used within a LedgerProvider");
  }
  return context;
}

export function useLedgerScope(): LedgerScope {
  const { scope, isReady } = useLedger();
  if (!isReady || !scope) {
    throw new Error("Ledger scope is not ready");
  }
  return scope;
}

export function useOptionalLedgerScope(): LedgerScope | null {
  const { scope, isReady } = useLedger();
  if (!isReady) return null;
  return scope;
}
