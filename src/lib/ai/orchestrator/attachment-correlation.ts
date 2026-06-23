import "server-only";

import { limitContextTokens } from "@/lib/agent/ledger-guardrails";
import { createChatCompletion } from "@/lib/ai/moonshot";
import type { AttachmentInput, KimiMessage } from "@/lib/ai/types";

const CORRELATION_SYSTEM = `You analyze multiple attachments from one user message.
Identify whether extracted file text and images refer to the same business data, clients, time period, or metrics.
Respond in 2-4 sentences. If related, explain how they connect. If unrelated, say they appear independent.
Do not invent data not present in the sources.`;

function snippetFromSystemMessage(message: KimiMessage, maxChars = 4000): string {
  if (typeof message.content !== "string") return "";
  return limitContextTokens(message.content, maxChars);
}

export async function correlateAttachments(input: {
  userInput: string;
  attachments: AttachmentInput[];
  fileSystemMessages: KimiMessage[];
  visionCount: number;
  memoryContext?: string | null;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (input.fileSystemMessages.length === 0 || input.visionCount === 0) {
    return null;
  }

  const fileSnippets = input.fileSystemMessages
    .map((message, index) => `File ${index + 1} extract:\n${snippetFromSystemMessage(message)}`)
    .join("\n\n");

  const attachmentList = input.attachments
    .map((file) => `- ${file.filename} (${file.mimeType})`)
    .join("\n");

  const userContent = [
    `User message: ${input.userInput}`,
    `Attachments:\n${attachmentList}`,
    `Images in this message: ${input.visionCount}`,
    fileSnippets,
    input.memoryContext ? `Prior workspace context: ${input.memoryContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await createChatCompletion({
      messages: [
        { role: "system", content: CORRELATION_SYSTEM },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
      maxTokens: 512,
      signal: input.signal,
    });

    const summary = result.content?.trim();
    if (!summary) return null;
    return `Related insights across attachments: ${summary}`;
  } catch {
    return null;
  }
}
