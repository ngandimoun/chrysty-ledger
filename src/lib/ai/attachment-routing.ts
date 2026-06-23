import {
  extractFilesToSystemMessages,
  shouldRouteToFileExtract,
  shouldRouteToVision,
} from "@/lib/ai/file-extract";
import { assertFileSizeWithinLimit, cleanupMoonshotFilesIfEnabled } from "@/lib/ai/files";
import { isVideoAttachment } from "@/lib/ai/supported-attachments";
import { buildChatMessages } from "@/lib/ai/messages";
import { createChatCompletion, type CreateChatCompletionOptions } from "@/lib/ai/moonshot";
import type {
  AttachmentInput,
  KimiCompletionResult,
  KimiMessage,
  KimiThinkingOptions,
  MoonshotFileSessionContext,
  PreparedAttachments,
} from "@/lib/ai/types";

export async function prepareAttachments(
  inputs: AttachmentInput[]
): Promise<PreparedAttachments> {
  const fileExtractInputs: AttachmentInput[] = [];
  const visionInputs: AttachmentInput[] = [];

  for (const input of inputs) {
    assertFileSizeWithinLimit(input.buffer, input.filename);

    if (
      isVideoAttachment({
        name: input.filename,
        type: input.mimeType,
        size: input.buffer.byteLength,
      })
    ) {
      throw new Error("Video files are not supported.");
    }

    if (shouldRouteToFileExtract(input)) {
      fileExtractInputs.push(input);
      continue;
    }

    if (shouldRouteToVision(input)) {
      visionInputs.push(input);
      continue;
    }

    throw new Error(
      `Unsupported attachment type for "${input.filename}" (${input.mimeType}).`
    );
  }

  const uploadedFileIds: string[] = [];
  let fileSystemMessages: PreparedAttachments["fileSystemMessages"] = [];

  if (fileExtractInputs.length > 0) {
    const extracted = await extractFilesToSystemMessages(fileExtractInputs);
    fileSystemMessages = extracted.systemMessages;
    uploadedFileIds.push(...extracted.fileIds);
  }

  return {
    fileSystemMessages,
    visionInputs,
    uploadedFileIds,
  };
}

export async function withMoonshotFileSession<T>(
  inputs: AttachmentInput[],
  fn: (context: MoonshotFileSessionContext) => Promise<T>
): Promise<T> {
  const prepared = await prepareAttachments(inputs);
  const uploadedFileIds = [...prepared.uploadedFileIds];

  try {
    return await fn({
      fileSystemMessages: prepared.fileSystemMessages,
      visionInputs: prepared.visionInputs,
      uploadedFileIds,
    });
  } finally {
    await cleanupMoonshotFilesIfEnabled(uploadedFileIds);
  }
}

export type RunChatWithAttachmentsOptions = {
  userInput: string;
  attachments?: AttachmentInput[];
  history?: KimiMessage[];
  maxHistory?: number;
  thinking?: KimiThinkingOptions;
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  responseFormat?: CreateChatCompletionOptions["responseFormat"];
};

export async function runChatWithAttachments(
  options: RunChatWithAttachmentsOptions
): Promise<KimiCompletionResult> {
  const attachments = options.attachments ?? [];

  if (attachments.length === 0) {
    const messages = await buildChatMessages({
      history: options.history,
      userInput: options.userInput,
      maxHistory: options.maxHistory,
    });

    return createChatCompletion({
      messages,
      thinking: options.thinking,
      model: options.model,
      maxTokens: options.maxTokens,
      signal: options.signal,
      responseFormat: options.responseFormat,
    });
  }

  return withMoonshotFileSession(attachments, async (context) => {
    const messages = await buildChatMessages({
      fileSystemMessages: context.fileSystemMessages,
      history: options.history,
      userInput: options.userInput,
      visionInputs: context.visionInputs,
      maxHistory: options.maxHistory,
      onVisionUploaded: (fileIds) => {
        context.uploadedFileIds.push(...fileIds);
      },
    });

    return createChatCompletion({
      messages,
      thinking: options.thinking,
      model: options.model,
      maxTokens: options.maxTokens,
      signal: options.signal,
      responseFormat: options.responseFormat,
    });
  });
}
