import { prepareAttachments } from "@/lib/ai/attachment-routing";
import type { ChatRequestMode } from "@/lib/chat-types";
import type { AttachmentInput, KimiMessage } from "@/lib/ai/types";
import { getMoonshotConfig } from "@/lib/ai/config";
import { buildVisionUserMessageFromInputs } from "@/lib/ai/vision";

export const LEDGER_SYSTEM_PROMPT = `You are Chrysty Ledger, an AI assistant for small business finance and bookkeeping workspaces. You help users track expenses, upload receipts, create invoices, import bank statements, and organize financial records. Provide safe, helpful, and accurate answers. When uncertain about extracted numbers or dates, say so clearly.`;

export const LEDGER_CHAT_FORMAT_APPENDIX = `Chat formatting rules:
- Reply in the user's language.
- Use markdown that renders well in a chat bubble: short paragraphs, ### headings, bullet lists, **bold** for emphasis.
- Prefer bullet lists over large markdown tables when collecting user input (e.g. invoice fields).
- Ask one step at a time for multi-step flows; avoid dumping 4 tables in one message.
- No horizontal rules (---) between sections.
- No emoji in headings; keep tone professional and concise.
- End with one clear next action when guidance is needed.
- When the user says "this", "that", "the above", or "same expense", resolve the reference from earlier messages in this thread. Never ask them to re-upload data already analyzed in a prior message.
- When the user asks for a chart, viz, graph, or dashboard: give brief insights only. Never use ASCII bar charts, block characters, or text gauges in chat — real charts and tables are saved to the workspace canvas automatically.
- If conversation context includes prior analysis or uploaded files, never ask the user to upload or paste data again.`;

export const LEDGER_TOOLS_SYSTEM_APPENDIX = `You have access to Kimi official tools. Use them proactively when they improve accuracy:
- $web_search or web_search for current tax rules, vendor information, exchange rates, and time-sensitive facts
- excel for spreadsheet and CSV analysis
- fetch for extracting content from URLs the user provides
- convert for currency and unit conversions
- date for parsing and normalizing dates
- code_runner and quickjs for calculations and reconciliation checks
- memory for remembering recurring user preferences within the conversation
- rethink for complex multi-step financial reasoning
- random-choice when the user asks you to pick between options
Use tools before guessing when external data or computation would help.`;

export const LEDGER_CHAT_SYSTEM_MESSAGES: KimiMessage[] = [
  { role: "system", content: LEDGER_SYSTEM_PROMPT },
  { role: "system", content: LEDGER_CHAT_FORMAT_APPENDIX },
  { role: "system", content: LEDGER_TOOLS_SYSTEM_APPENDIX },
];

export const LEDGER_SEARCH_SYSTEM_APPENDIX = `The user enabled Search mode. Use $web_search or web_search proactively for current tax rules, exchange rates, vendor information, and any time-sensitive facts before answering.`;

export const LEDGER_THINK_SYSTEM_APPENDIX = `The user enabled Think mode. Reason step-by-step before answering. Provide a clear, well-structured final answer.`;

export const LEDGER_CANVAS_SYSTEM_APPENDIX = `The user enabled Canvas mode. Prioritize creating structured workspace artifacts the user can open in the asset canvas: transaction tables, receipt summaries, invoice drafts, and categorized expense lists. When data can be organized as a table or document, format it for easy conversion to a workspace asset.`;

export function getModeSystemMessages(mode: ChatRequestMode): KimiMessage[] {
  const messages: KimiMessage[] = [...LEDGER_CHAT_SYSTEM_MESSAGES];

  switch (mode) {
    case "search":
      messages.push({ role: "system", content: LEDGER_SEARCH_SYSTEM_APPENDIX });
      break;
    case "think":
      messages.push({ role: "system", content: LEDGER_THINK_SYSTEM_APPENDIX });
      break;
    case "canvas":
      messages.push({ role: "system", content: LEDGER_CANVAS_SYSTEM_APPENDIX });
      break;
    default:
      break;
  }

  return messages;
}

export const LEDGER_JSON_EXTRACTION_PROMPT = `When extracting financial data from documents, respond using JSON Mode with a single JSON Object (not an array at the root).

Use this schema:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD or best estimate",
      "vendor": "merchant or payee name",
      "amount": "numeric amount with currency if visible",
      "category": "expense category"
    }
  ],
  "summary": "optional short summary of what was extracted"
}

Rules:
- Output only valid JSON matching the schema above.
- Include every transaction you can read from the provided documents.
- Use empty strings when a field is unreadable instead of guessing.`;

export const LEDGER_VISION_EXTRACTION_PROMPT = `Analyze the attached receipt, invoice, or bank statement images carefully. Read printed text, handwriting when legible, totals, dates, vendors, and line items. Combine visual evidence with the user's instructions.`;

export const LEDGER_SYSTEM_MESSAGES: KimiMessage[] = [
  { role: "system", content: LEDGER_SYSTEM_PROMPT },
];

export const LEDGER_JSON_SYSTEM_MESSAGES: KimiMessage[] = [
  { role: "system", content: LEDGER_SYSTEM_PROMPT },
  { role: "system", content: LEDGER_JSON_EXTRACTION_PROMPT },
];

export type BuildExtractionMessagesOptions = {
  userInput: string;
  attachments?: AttachmentInput[];
  fileSystemMessages?: KimiMessage[];
  visionInputs?: AttachmentInput[];
  history?: KimiMessage[];
  maxHistory?: number;
  onVisionUploaded?: (fileIds: string[]) => void;
};

export async function buildExtractionMessages(
  options: BuildExtractionMessagesOptions
): Promise<KimiMessage[]> {
  const text =
    options.userInput.trim() ||
    "Extract all transactions from the attached documents.";

  const userInput = `${LEDGER_VISION_EXTRACTION_PROMPT}\n\n${text}`;
  const history = trimHistory(options.history ?? [], options.maxHistory);
  const visionInputs = options.visionInputs ?? options.attachments ?? [];

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

  const fileSystemMessages = options.fileSystemMessages ?? [];

  return [...fileSystemMessages, ...LEDGER_JSON_SYSTEM_MESSAGES, ...history, userMessage];
}

export type BuildExtractionMessagesFromAttachmentsOptions = {
  userInput: string;
  attachments: AttachmentInput[];
  history?: KimiMessage[];
  maxHistory?: number;
  onVisionUploaded?: (fileIds: string[]) => void;
};

export async function buildExtractionMessagesFromAttachments(
  options: BuildExtractionMessagesFromAttachmentsOptions
): Promise<{ messages: KimiMessage[]; uploadedFileIds: string[] }> {
  const prepared = await prepareAttachments(options.attachments);
  const uploadedFileIds = [...prepared.uploadedFileIds];

  const messages = await buildExtractionMessages({
    userInput: options.userInput,
    fileSystemMessages: prepared.fileSystemMessages,
    visionInputs: prepared.visionInputs,
    history: options.history,
    maxHistory: options.maxHistory,
    onVisionUploaded: (fileIds) => {
      uploadedFileIds.push(...fileIds);
      options.onVisionUploaded?.(fileIds);
    },
  });

  return { messages, uploadedFileIds };
}

export type BuildVisionAwareUserMessageOptions = {
  userInput: string;
  attachments?: AttachmentInput[];
  visionInputs?: AttachmentInput[];
  onVisionUploaded?: (fileIds: string[]) => void;
};

export async function buildVisionAwareUserMessage(
  options: BuildVisionAwareUserMessageOptions
): Promise<KimiMessage> {
  const trimmed = options.userInput.trim();
  const visionInputs = options.visionInputs ?? options.attachments ?? [];

  if (visionInputs.length === 0) {
    return { role: "user", content: trimmed };
  }

  const visionMessage = await buildVisionUserMessageFromInputs({
    userInput: trimmed,
    visionInputs,
  });
  options.onVisionUploaded?.(visionMessage.uploadedFileIds);

  return {
    role: "user",
    content: visionMessage.content,
  };
}

function trimHistory(history: KimiMessage[], maxHistory?: number): KimiMessage[] {
  const limit = maxHistory ?? getMoonshotConfig().maxHistoryMessages;
  if (history.length <= limit) return history;
  return history.slice(-limit);
}
