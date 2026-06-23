import { runActionHandler } from "@/lib/ai/orchestrator/handlers/action-handler";
import type {
  LedgerOrchestratorOptions,
  LedgerOrchestratorResult,
} from "@/lib/ai/orchestrator/ledger-route-types";
import type { ChatSseEvent } from "@/lib/ai/types";

export type { LedgerOrchestratorOptions, LedgerOrchestratorResult } from "@/lib/ai/orchestrator/ledger-route-types";

export async function runLedgerOrchestrator(
  options: LedgerOrchestratorOptions
): Promise<LedgerOrchestratorResult> {
  const onEvent = options.onEvent;
  const emit = (event: ChatSseEvent) => onEvent?.(event);

  emit({ type: "phase", name: "plan", status: "start" });
  const result = await runActionHandler(options);
  emit({ type: "phase", name: "plan", status: "done" });
  emit({ type: "done" });

  return result;
}
