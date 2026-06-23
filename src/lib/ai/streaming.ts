import type OpenAI from "openai";

import {
  getDeltaContent,
  getDeltaReasoningContent,
  getDeltaRole,
  type StreamPhase,
} from "@/lib/ai/reasoning";
import { normalizeUsage } from "@/lib/ai/retry";
import type { ChatSseEvent, KimiStreamEvent, KimiStreamResult, KimiUsage } from "@/lib/ai/types";
import type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";

export function parseStreamChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): KimiStreamEvent[] {
  const events: KimiStreamEvent[] = [];
  const choice = chunk.choices[0];
  if (!choice) return events;

  const delta = choice.delta;
  const role = getDeltaRole(delta);
  if (role) {
    events.push({ type: "role", role });
  }

  const reasoningDelta = getDeltaReasoningContent(delta);
  if (reasoningDelta) {
    events.push({ type: "reasoning", delta: reasoningDelta });
  }

  const contentDelta = getDeltaContent(delta);
  if (contentDelta) {
    events.push({ type: "content", delta: contentDelta });
  }

  const usage = normalizeUsage(chunk.usage);
  if (usage) {
    events.push({ type: "usage", usage });
  }

  return events;
}

export class KimiStreamAccumulator {
  content = "";
  reasoningContent = "";
  usage: KimiUsage | null = null;
  phase: StreamPhase = "idle";
  completed = false;

  ingest(event: KimiStreamEvent): void {
    switch (event.type) {
      case "reasoning":
        this.phase = "reasoning";
        this.reasoningContent += event.delta;
        break;
      case "content":
        this.phase = "content";
        this.content += event.delta;
        break;
      case "usage":
        this.usage = event.usage;
        break;
      case "done":
        this.completed = true;
        break;
      default:
        break;
    }
  }

  toResult(): KimiStreamResult {
    return {
      content: this.content,
      reasoningContent: this.reasoningContent,
      usage: this.usage,
      completed: this.completed,
    };
  }
}

export async function* collectStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
): AsyncGenerator<KimiStreamEvent> {
  const accumulator = new KimiStreamAccumulator();

  for await (const chunk of stream) {
    for (const event of parseStreamChunk(chunk)) {
      accumulator.ingest(event);
      yield event;
    }
  }

  accumulator.completed = true;
  yield { type: "done" };
}

export function createSsePayload(
  event: KimiStreamEvent | ChatSseEvent | AgentRunSseEvent
): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseDonePayload(): string {
  return "data: [DONE]\n\n";
}
