export function getReasoningContent(message: unknown): string | null {
  if (
    typeof message === "object" &&
    message !== null &&
    "reasoning_content" in message &&
    typeof (message as { reasoning_content?: unknown }).reasoning_content === "string"
  ) {
    return (message as { reasoning_content: string }).reasoning_content;
  }
  return null;
}

export function getDeltaReasoningContent(delta: unknown): string | null {
  if (
    typeof delta === "object" &&
    delta !== null &&
    "reasoning_content" in delta &&
    typeof (delta as { reasoning_content?: unknown }).reasoning_content === "string"
  ) {
    return (delta as { reasoning_content: string }).reasoning_content;
  }
  return null;
}

export function getDeltaContent(delta: unknown): string | null {
  if (
    typeof delta === "object" &&
    delta !== null &&
    "content" in delta &&
    typeof (delta as { content?: unknown }).content === "string"
  ) {
    return (delta as { content: string }).content;
  }
  return null;
}

export function getDeltaRole(delta: unknown): string | null {
  if (
    typeof delta === "object" &&
    delta !== null &&
    "role" in delta &&
    typeof (delta as { role?: unknown }).role === "string"
  ) {
    return (delta as { role: string }).role;
  }
  return null;
}

export type StreamPhase = "idle" | "reasoning" | "content";

export function nextStreamPhase(current: StreamPhase, delta: unknown): StreamPhase {
  if (getDeltaReasoningContent(delta)) return "reasoning";
  if (getDeltaContent(delta)) return current === "idle" ? "content" : "content";
  return current;
}
