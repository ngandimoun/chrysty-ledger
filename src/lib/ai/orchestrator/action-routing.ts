import { isImageMime } from "@/lib/ai/vision";

type ActionStepLike = {
  action: string;
  inputs: Record<string, unknown>;
};

function isConversationalPlan(actions: ActionStepLike[]): boolean {
  return (
    actions.length === 1 &&
    actions[0]?.action === "create" &&
    actions[0]?.inputs?.conversational === true
  );
}

function planNeedsWebSearch(actions: ActionStepLike[], mode: string): boolean {
  const hasImport = actions.some(
    (step) => step.action === "import" || step.action === "transform"
  );
  if (hasImport) return false;
  return mode === "search";
}

function planExplicitSpreadsheetImport(actions: ActionStepLike[]): boolean {
  return actions.some(
    (step) =>
      step.action === "import" &&
      step.inputs?.useAttachments === true &&
      !actions.some((other) => other.action === "transform" && other.inputs?.targetKind)
  );
}

function hasConcreteCreatePayload(inputs: Record<string, unknown>): boolean {
  if (inputs.conversational === true) return false;

  const schema = inputs.schema;
  const data = inputs.data;
  const hasSchema =
    schema !== null &&
    typeof schema === "object" &&
    Object.keys(schema as object).length > 0;
  const hasData =
    data !== null && typeof data === "object" && Object.keys(data as object).length > 0;

  if (!hasSchema || !hasData) return false;

  const dataObj = data as Record<string, unknown>;
  const sections = dataObj.sections as Array<{ body?: string }> | undefined;
  if (Array.isArray(sections) && sections.length === 1 && !sections[0]?.body?.trim()) {
    return false;
  }

  return true;
}

function planHasDataOperations(
  actions: ActionStepLike[],
  context: { attachmentCount: number; assetCount: number }
): boolean {
  return actions.some((step) => {
    if (step.action === "import") return context.attachmentCount > 0;
    if (step.action === "transform" || step.action === "export" || step.action === "link") {
      return context.attachmentCount > 0 || context.assetCount > 0;
    }
    if (step.action === "analyze") return context.assetCount > 0;
    if (step.action === "create") return hasConcreteCreatePayload(step.inputs);
    if (step.action === "read" || step.action === "update" || step.action === "delete") {
      return context.assetCount > 0;
    }
    return false;
  });
}

export function hasVisionAttachments(attachmentTypes: string[]): boolean {
  return attachmentTypes.some(isImageMime);
}

export function hasOnlyVisionAttachments(attachmentTypes: string[]): boolean {
  return attachmentTypes.length > 0 && attachmentTypes.every(isImageMime);
}

export function hasMixedFileAndVision(attachmentTypes: string[]): boolean {
  const hasVision = attachmentTypes.some(isImageMime);
  const hasFile = attachmentTypes.some((type) => !isImageMime(type));
  return hasVision && hasFile;
}

export function shouldRouteToChat(input: {
  actions: ActionStepLike[];
  attachmentCount: number;
  attachmentTypes: string[];
  assetCount: number;
  mode: string;
}): boolean {
  const visionPresent = hasVisionAttachments(input.attachmentTypes);
  const mixed = hasMixedFileAndVision(input.attachmentTypes);
  const onlyVision = hasOnlyVisionAttachments(input.attachmentTypes);

  if (onlyVision || mixed) {
    return true;
  }

  if (visionPresent && !planExplicitSpreadsheetImport(input.actions)) {
    return true;
  }

  return (
    isConversationalPlan(input.actions) ||
    (planNeedsWebSearch(input.actions, input.mode) && input.attachmentCount === 0) ||
    (input.attachmentCount === 0 &&
      !planHasDataOperations(input.actions, {
        attachmentCount: input.attachmentCount,
        assetCount: input.assetCount,
      }))
  );
}
