"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { workspaceAssetToRef } from "@/components/workspace/assets-explorer/asset-utils";
import type { WorkspaceAsset } from "@/lib/asset-types";
import type { AssetRef } from "@/lib/chat-types";

type ChatAssetRefsContextValue = {
  chatAssetRefs: AssetRef[];
  addChatAssetRef: (asset: WorkspaceAsset) => void;
  removeChatAssetRef: (id: string) => void;
  clearChatAssetRefs: () => void;
  focusChatInput: () => void;
  registerChatInputFocus: (focus: (() => void) | null) => void;
};

const ChatAssetRefsContext = createContext<ChatAssetRefsContextValue | null>(null);

export function ChatAssetRefsProvider({ children }: { children: ReactNode }) {
  const [chatAssetRefs, setChatAssetRefs] = useState<AssetRef[]>([]);
  const [focusChatInputFn, setFocusChatInputFn] = useState<(() => void) | null>(null);

  const addChatAssetRef = useCallback((asset: WorkspaceAsset) => {
    const ref = workspaceAssetToRef(asset);
    setChatAssetRefs((current) => {
      if (current.some((item) => item.id === ref.id)) {
        toast.info("Asset already added to chat");
        return current;
      }
      return [...current, ref];
    });
    focusChatInputFn?.();
  }, [focusChatInputFn]);

  const removeChatAssetRef = useCallback((id: string) => {
    setChatAssetRefs((current) => current.filter((ref) => ref.id !== id));
  }, []);

  const clearChatAssetRefs = useCallback(() => {
    setChatAssetRefs([]);
  }, []);

  const registerChatInputFocus = useCallback((focus: (() => void) | null) => {
    setFocusChatInputFn(() => focus);
  }, []);

  const focusChatInput = useCallback(() => {
    focusChatInputFn?.();
  }, [focusChatInputFn]);

  const value = useMemo(
    () => ({
      chatAssetRefs,
      addChatAssetRef,
      removeChatAssetRef,
      clearChatAssetRefs,
      focusChatInput,
      registerChatInputFocus,
    }),
    [
      chatAssetRefs,
      addChatAssetRef,
      removeChatAssetRef,
      clearChatAssetRefs,
      focusChatInput,
      registerChatInputFocus,
    ]
  );

  return (
    <ChatAssetRefsContext.Provider value={value}>{children}</ChatAssetRefsContext.Provider>
  );
}

export function useChatAssetRefs() {
  const context = useContext(ChatAssetRefsContext);
  if (!context) {
    throw new Error("useChatAssetRefs must be used within ChatAssetRefsProvider");
  }
  return context;
}

export function useOptionalChatAssetRefs() {
  return useContext(ChatAssetRefsContext);
}
