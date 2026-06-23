import type { ChatRequestMode } from "@/lib/chat-types";
import { resolveWebSearchMode } from "@/lib/ai/official-tools";
import { getModeSystemMessages } from "@/lib/ai/prompts";
import type { KimiMessage, KimiThinkingOptions, MoonshotWebSearchMode } from "@/lib/ai/types";

export type ResolvedChatModeConfig = {
  webSearchMode: MoonshotWebSearchMode;
  thinking?: KimiThinkingOptions;
  systemMessages: KimiMessage[];
};

export function resolveChatModeConfig(mode: ChatRequestMode = "default"): ResolvedChatModeConfig {
  const defaultWebSearch = resolveWebSearchMode();
  const defaultThinking: KimiThinkingOptions | undefined =
    defaultWebSearch === "builtin" ? { type: "disabled" } : undefined;

  switch (mode) {
    case "search":
      return {
        webSearchMode: "builtin",
        thinking: { type: "disabled" },
        systemMessages: getModeSystemMessages("search"),
      };
    case "think":
      return {
        webSearchMode: "off",
        thinking: { type: "enabled" },
        systemMessages: getModeSystemMessages("think"),
      };
    case "canvas":
      return {
        webSearchMode: defaultWebSearch,
        thinking: defaultThinking,
        systemMessages: getModeSystemMessages("canvas"),
      };
    default:
      return {
        webSearchMode: defaultWebSearch,
        thinking: defaultThinking,
        systemMessages: getModeSystemMessages("default"),
      };
  }
}

export function parseChatRequestMode(raw: string | null | undefined): ChatRequestMode {
  const normalized = (raw ?? "default").trim().toLowerCase();
  if (normalized === "search" || normalized === "think" || normalized === "canvas") {
    return normalized;
  }
  return "default";
}
