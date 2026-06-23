import type { KimiOfficialFormulaShortName } from "@/lib/ai/official-tools";
import type { LedgerRoute, LedgerRoutePlan } from "@/lib/ai/orchestrator/ledger-route-types";

const ROUTE_TOOL_PROFILES: Record<LedgerRoute, KimiOfficialFormulaShortName[]> = {
  chat: [],
  search: ["fetch"],
  extract: ["excel", "date"],
  analyze: [],
  bulk_import: ["excel", "date"],
  create_asset: ["excel", "code_runner", "quickjs", "date"],
};

export function getToolsForRoute(route: LedgerRoute): KimiOfficialFormulaShortName[] {
  return [...ROUTE_TOOL_PROFILES[route]];
}

export function applyModeBias(
  plan: LedgerRoutePlan,
  mode: import("@/lib/chat-types").ChatRequestMode
): LedgerRoutePlan {
  if (mode === "search" && plan.route === "chat") {
    return {
      ...plan,
      route: "search",
      tools: getToolsForRoute("search"),
      userFacingPhase: "Searching for current information…",
    };
  }

  if (mode === "think") {
    return { ...plan, thinking: true };
  }

  if (mode === "canvas" && plan.route === "chat") {
    return {
      ...plan,
      route: "create_asset",
      tools: getToolsForRoute("create_asset"),
      userFacingPhase: "Preparing a workspace asset…",
    };
  }

  return plan;
}

export function mergePlanTools(
  plan: LedgerRoutePlan,
  extra: KimiOfficialFormulaShortName[]
): KimiOfficialFormulaShortName[] {
  return [...new Set([...plan.tools, ...extra])];
}
