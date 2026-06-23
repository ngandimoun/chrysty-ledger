import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatMessage } from "@/lib/chat-types";
import { getMoonshotConfig } from "@/lib/ai/config";
import { LEDGER_CHAT_SYSTEM_MESSAGES, LEDGER_SYSTEM_MESSAGES } from "@/lib/ai/prompts";
import type { AttachmentInput, KimiMessage } from "@/lib/ai/types";
import { buildVisionUserMessageFromInputs } from "@/lib/ai/vision";

const PROMPT_PREFIX_PATTERN = /^\[(Search|Think|Canvas):\s*/i;

export function stripPromptPrefix(input: string): string {
  return input.replace(PROMPT_PREFIX_PATTERN, "").replace(/\]\s*$/, "").trim();
}

export function chatMessageToKimiMessage(message: ChatMessage): KimiMessage | null {
  if (message.role === "user" && message.type === "text") {
    const attachmentNote =
      message.files && message.files.length > 0
        ? `\n[Attached ${message.files.length} file(s): ${message.files.map((file) => file.name).join(", ")}]`
        : "";
    const assetRefNote =
      message.assetRefs && message.assetRefs.length > 0
        ? `\n[Referenced assets: ${message.assetRefs.map((ref) => `${ref.title} (${ref.kind})`).join(", ")}]`
        : "";
    return {
      role: "user",
      content: `${stripPromptPrefix(message.content)}${attachmentNote}${assetRefNote}`.trim(),
    };
  }

  if (message.role === "assistant" && message.type === "text") {
    return {
      role: "assistant",
      content: message.content,
    };
  }

  if (message.role === "assistant" && message.type === "artifact") {
    const verb = message.summary.toLowerCase().startsWith("updated") ? "Updated" : "Created";
    return {
      role: "assistant",
      content: `${verb} ${message.artifact.kind}: ${message.artifact.title} — ${message.summary}`,
    };
  }

  if (message.role === "assistant" && message.type === "created") {
    const titles = message.assets.map((asset) => asset.title).join(", ");
    return {
      role: "assistant",
      content: `${message.content}${titles ? ` (${titles})` : ""}`,
    };
  }

  if (message.role === "assistant" && message.type === "updated") {
    const titles = message.assets.map((asset) => asset.title).join(", ");
    return {
      role: "assistant",
      content: `${message.content}${titles ? ` (${titles})` : ""}`,
    };
  }

  return null;
}

export function appendAssistantTurn(history: KimiMessage[], rawMessage: unknown): KimiMessage[] {
  return [...history, rawMessage as KimiMessage];
}

export type BuildChatMessagesOptions = {
  systemMessages?: KimiMessage[];
  fileSystemMessages?: KimiMessage[];
  history?: KimiMessage[];
  userInput: string;
  attachments?: AttachmentInput[];
  visionInputs?: AttachmentInput[];
  maxHistory?: number;
  onVisionUploaded?: (fileIds: string[]) => void;
};

export async function buildChatMessages(options: BuildChatMessagesOptions): Promise<KimiMessage[]> {
  const systemMessages = options.systemMessages ?? LEDGER_SYSTEM_MESSAGES;
  const fileSystemMessages = options.fileSystemMessages ?? [];
  const history = trimHistory(options.history ?? [], options.maxHistory);
  const userInput = stripPromptPrefix(options.userInput);

  const visionInputs =
    options.visionInputs ??
    options.attachments ??
    [];

  let userMessage: KimiMessage;

  if (visionInputs.length > 0) {
    const visionMessage = await buildVisionUserMessageFromInputs({
      userInput,
      visionInputs,
    });
    options.onVisionUploaded?.(visionMessage.uploadedFileIds);
    userMessage = {
      role: "user",
      content: visionMessage.content,
    };
  } else {
    userMessage = { role: "user", content: userInput };
  }

  return [...fileSystemMessages, ...systemMessages, ...history, userMessage];
}

export function buildChatMessagesFromAppHistory(options: {
  appHistory: ChatMessage[];
  userInput: string;
  attachments?: AttachmentInput[];
  fileSystemMessages?: KimiMessage[];
  visionInputs?: AttachmentInput[];
  maxHistory?: number;
  systemMessages?: KimiMessage[];
  onVisionUploaded?: (fileIds: string[]) => void;
}): Promise<KimiMessage[]> {
  const kimiHistory = options.appHistory
    .map(chatMessageToKimiMessage)
    .filter((message): message is KimiMessage => message !== null);

  return buildChatMessages({
    systemMessages: options.systemMessages ?? LEDGER_CHAT_SYSTEM_MESSAGES,
    fileSystemMessages: options.fileSystemMessages,
    history: kimiHistory,
    userInput: options.userInput,
    attachments: options.attachments,
    visionInputs: options.visionInputs,
    maxHistory: options.maxHistory,
    onVisionUploaded: options.onVisionUploaded,
  });
}

function trimHistory(history: KimiMessage[], maxHistory?: number): KimiMessage[] {
  const limit = maxHistory ?? getMoonshotConfig().maxHistoryMessages;
  if (history.length <= limit) return history;
  return history.slice(-limit);
}

function slimArtifactForApi(artifact: WorkspaceArtifact): WorkspaceArtifact {
  switch (artifact.kind) {
    case "chart":
      return {
        id: artifact.id,
        kind: "chart",
        title: artifact.title,
        chartType: artifact.chartType,
        data: [],
      };
    case "table":
      return {
        id: artifact.id,
        kind: "table",
        title: artifact.title,
        columns: [],
        rows: [],
      };
    case "file-list":
      return { id: artifact.id, kind: "file-list", title: artifact.title, files: [] };
    case "document":
      return { id: artifact.id, kind: "document", title: artifact.title, content: "" };
    case "dashboard":
      return { id: artifact.id, kind: "dashboard", title: artifact.title, kpis: [] };
    case "invoice":
      return {
        id: artifact.id,
        kind: "invoice",
        title: artifact.title,
        invoiceNumber: "",
        clientName: "",
        issueDate: "",
        dueDate: "",
        lineItems: [],
        total: "",
      };
  }
}

export function slimMessagesForApi(
  messages: ChatMessage[],
  maxHistory?: number
): ChatMessage[] {
  const limit = maxHistory ?? getMoonshotConfig().maxHistoryMessages;
  const recent = messages.length <= limit ? messages : messages.slice(-limit);

  return recent.map((message) => {
    if (message.type === "artifact") {
      return {
        ...message,
        artifact: slimArtifactForApi(message.artifact),
      };
    }
    return message;
  });
}
