import { createMessageId } from "@/lib/chat-types";
import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";
import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import { resolveToolsForStep } from "@/lib/agent-actions/tool-profiles";
import {
  archiveAssetV2,
  createAssetV2,
  createProjectV2,
  getAssetV2,
  linkAssetsV2,
  listAssetsV2,
  searchAssetsV2,
  updateAssetV2,
} from "@/lib/assets/service";
import { resolveVariable } from "@/lib/agent-actions/action-planner";
import type { ActionPlan } from "@/lib/agent-actions/types";
import type { ActionContext, ActionResult, ActionStep } from "@/lib/agent-actions/types";
import { withMoonshotFileSession } from "@/lib/ai/attachment-routing";
import type { AttachmentInput, ToolCallRecord } from "@/lib/ai/types";

async function persistValidatedDefinition(
  scope: ActionContext["scope"],
  def: AssetDefinitionInput,
  ctx: ActionContext,
  createdAssets: Asset[],
  linkToId?: string
): Promise<Asset | null> {
  const result = await createAssetV2(scope, {
    ...def,
    projectId: def.projectId ?? ctx.variables.$project,
  });

  if ("error" in result) {
    return null;
  }

  ctx.onEvent?.({ type: "asset_created", asset: result.asset });
  createdAssets.push(result.asset);
  ctx.variables.$prev = result.asset.id;

  if (linkToId) {
    await linkAssetsV2(scope, ctx.workspaceId, result.asset.id, linkToId, "derived_from");
  }

  return result.asset;
}

async function executeStep(
  step: ActionStep,
  ctx: ActionContext,
  createdAssets: Asset[],
  toolCallsExecuted: ToolCallRecord[]
): Promise<{ text?: string; asset?: Asset; variable?: string }> {
  const { scope, workspaceId, onEvent } = ctx;
  const inputs = step.inputs;

  switch (step.action) {
    case "create": {
      if (inputs.conversational) {
        return { text: "__conversational__" };
      }
      if (inputs.kind === "project") {
        const project = await createProjectV2(scope, workspaceId, String(inputs.title ?? "Project"));
        onEvent?.({ type: "phase", name: "project", status: "done" });
        ctx.variables.$project = project.id;
        return { text: `Created project ${project.title}`, variable: project.id };
      }

      const def: AssetDefinitionInput = {
        workspaceId,
        projectId: inputs.projectId ? String(inputs.projectId) : ctx.variables.$project,
        kind: String(inputs.kind ?? "document"),
        subtype: inputs.subtype ? String(inputs.subtype) : undefined,
        title: String(inputs.title ?? "Untitled"),
        schema: (inputs.schema as Record<string, unknown>) ?? {},
        data: (inputs.data as Record<string, unknown>) ?? {},
        metadata: (inputs.metadata as Record<string, unknown>) ?? {},
      };

      const asset = await persistValidatedDefinition(scope, def, ctx, createdAssets);
      if (!asset) {
        return { text: "Failed to create asset: validation or save error" };
      }
      return { asset, variable: asset.id };
    }

    case "read": {
      const assetId = resolveVariable(String(inputs.assetId ?? "$prev"), ctx.variables);
      if (!assetId) return {};
      const asset = await getAssetV2(scope, workspaceId, assetId);
      return { text: asset ? JSON.stringify({ title: asset.title, kind: asset.kind }) : "Not found" };
    }

    case "update": {
      const assetId = resolveVariable(String(inputs.assetId ?? "$prev"), ctx.variables);
      if (!assetId) return {};
      const result = await updateAssetV2(scope, workspaceId, assetId, {
        schema: inputs.schema as Record<string, unknown>,
        data: inputs.data as Record<string, unknown>,
        title: inputs.title ? String(inputs.title) : undefined,
      });
      if ("error" in result) return { text: result.error.message };
      onEvent?.({ type: "asset_updated", asset: result.asset });
      return { asset: result.asset };
    }

    case "delete": {
      const assetId = resolveVariable(String(inputs.assetId ?? "$prev"), ctx.variables);
      if (!assetId) return {};
      await archiveAssetV2(scope, workspaceId, assetId);
      onEvent?.({ type: "asset_archived", assetId });
      return { text: "Asset archived" };
    }

    case "search": {
      const query = String(inputs.query ?? "");
      const assets = await searchAssetsV2(scope, workspaceId, query);
      return { text: assets.map((a) => `${a.title} (${a.kind})`).join(", ") || "No matches" };
    }

    case "link": {
      const from = resolveVariable(String(inputs.fromVar ?? inputs.from ?? "$prev"), ctx.variables);
      const to = resolveVariable(String(inputs.toVar ?? inputs.to ?? "$prev2"), ctx.variables);
      const relation = String(inputs.relation ?? "feeds");
      if (from && to) {
        await linkAssetsV2(scope, workspaceId, from, to, relation);
      }
      return {};
    }

    case "import": {
      const attachments = ctx.attachments ?? [];
      if (attachments.length === 0) {
        return { text: "No files to import" };
      }

      const assets: Asset[] = [];
      let summary: string | undefined;

      await withMoonshotFileSession(attachments, async (session) => {
        const tools = resolveToolsForStep("import", {
          stepTools: step.tools,
          attachments,
        });

        const extraction = await runKimiStructuredExtraction({
          workspaceId,
          userInput: ctx.userInput || "Extract and structure the uploaded financial documents.",
          enabledTools: tools,
          mode: "import",
          fileSystemMessages: session.fileSystemMessages,
          visionInputs: session.visionInputs,
          signal: ctx.signal,
          onEvent,
        });

        toolCallsExecuted.push(...extraction.toolCallsExecuted);
        summary = extraction.summary;

        for (let i = 0; i < attachments.length; i += 1) {
          const file = attachments[i];
          const fileId = session.uploadedFileIds[i];
          const fileResult = await createAssetV2(scope, {
            workspaceId,
            projectId: ctx.variables.$project,
            kind: "file",
            subtype: "upload",
            title: file.filename,
            schema: { filename: file.filename, mimeType: file.mimeType },
            data: {
              storageRef: fileId ? `moonshot://${fileId}` : `upload://${createMessageId()}`,
              size: file.buffer.byteLength,
            },
          });

          if (!("error" in fileResult)) {
            onEvent?.({ type: "asset_created", asset: fileResult.asset });
            assets.push(fileResult.asset);
            ctx.variables.$file = fileResult.asset.id;
          }
        }

        for (const def of extraction.definitions) {
          const asset = await persistValidatedDefinition(
            scope,
            def,
            ctx,
            createdAssets,
            ctx.variables.$file
          );
          if (asset) {
            assets.push(asset);
          }
        }

        if (extraction.errors.length > 0 && extraction.definitions.length === 0) {
          summary = extraction.errors.join("; ");
        }
      });

      return {
        asset: assets[assets.length - 1] ?? createdAssets[createdAssets.length - 1],
        variable: ctx.variables.$prev,
        text: summary,
      };
    }

    case "transform": {
      const sourceId = resolveVariable(String(inputs.sourceVar ?? inputs.sourceAssetId ?? "$prev"), ctx.variables);
      if (!sourceId) return {};
      const source = await getAssetV2(scope, workspaceId, sourceId);
      if (!source) return { text: "Source asset not found" };

      const targetKind = String(inputs.targetKind ?? "document");
      const subtype = inputs.subtype ? String(inputs.subtype) : undefined;
      const tools = resolveToolsForStep("transform", {
        stepTools: step.tools,
        sourceAssets: [source],
      });

      const extraction = await runKimiStructuredExtraction({
        workspaceId,
        userInput: ctx.userInput || `Transform into ${targetKind}`,
        enabledTools: tools,
        mode: "transform",
        sourceAssets: [source],
        targetKind,
        subtype,
        signal: ctx.signal,
        onEvent,
      });

      toolCallsExecuted.push(...extraction.toolCallsExecuted);

      const def = extraction.definitions[0];
      if (!def) {
        return { text: extraction.errors.join("; ") || "Transform produced no valid asset" };
      }

      const asset = await persistValidatedDefinition(scope, def, ctx, createdAssets, sourceId);
      if (!asset) {
        return { text: "Transform validation failed" };
      }

      return { asset, variable: asset.id, text: extraction.summary };
    }

    case "analyze": {
      const sourceId = resolveVariable(String(inputs.sourceAssetId ?? "$prev"), ctx.variables);
      const sources = sourceId
        ? [await getAssetV2(scope, workspaceId, sourceId)]
        : await listAssetsV2(scope, workspaceId);
      const filtered = sources.filter(Boolean) as Asset[];

      const tools = resolveToolsForStep("analyze", {
        stepTools: step.tools,
        sourceAssets: filtered,
      });

      const targetKind = String(inputs.targetKind ?? "document");
      const extraction = await runKimiStructuredExtraction({
        workspaceId,
        userInput: ctx.userInput || "Analyze workspace financial data",
        enabledTools: tools,
        mode: "analyze",
        sourceAssets: filtered,
        targetKind,
        subtype: inputs.subtype ? String(inputs.subtype) : "analysis",
        signal: ctx.signal,
        onEvent,
      });

      toolCallsExecuted.push(...extraction.toolCallsExecuted);

      const def = extraction.definitions[0];
      if (!def) {
        return { text: extraction.errors.join("; ") || "Analysis produced no valid asset" };
      }

      const asset = await persistValidatedDefinition(scope, def, ctx, createdAssets);
      if (!asset) {
        return { text: extraction.errors.join("; ") || "Analysis validation failed" };
      }

      return { asset, text: extraction.summary ?? asset.title };
    }

    case "export": {
      const assetId = resolveVariable(String(inputs.assetId ?? "$prev"), ctx.variables);
      if (!assetId) return {};
      const asset = await getAssetV2(scope, workspaceId, assetId);
      if (!asset || asset.kind !== "table") return { text: "Export requires a table asset" };
      const columns = (asset.schema.columns as { key: string; label: string }[]) ?? [];
      const rows = (asset.data.rows as Record<string, string>[]) ?? [];
      const header = columns.map((c) => c.label).join(",");
      const body = rows.map((r) => columns.map((c) => JSON.stringify(r[c.key] ?? "")).join(",")).join("\n");
      return { text: [header, body].filter(Boolean).join("\n") };
    }

    default:
      return {};
  }
}

export async function executeActionPlan(
  plan: ActionPlan,
  ctx: ActionContext
): Promise<ActionResult> {
  const createdAssets: Asset[] = [];
  const textParts: string[] = [];
  const toolCallsExecuted: ToolCallRecord[] = [];

  ctx.onEvent?.({ type: "route", route: "actions", phase: plan.userFacingPhase });
  ctx.onEvent?.({ type: "phase", name: "actions", status: "start" });

  let stepIndex = 0;
  for (const step of plan.actions) {
    ctx.variables[`$step${stepIndex}`] = ctx.variables.$prev ?? "";
    stepIndex += 1;
    ctx.onEvent?.({ type: "phase", name: step.action, status: "start" });
    const outcome = await executeStep(step, ctx, createdAssets, toolCallsExecuted);
    if (outcome.text) textParts.push(outcome.text);
    if (outcome.variable) ctx.variables.$prev2 = ctx.variables.$prev;
    ctx.onEvent?.({ type: "phase", name: step.action, status: "done" });
  }

  ctx.onEvent?.({ type: "phase", name: "actions", status: "done" });

  return {
    text: plan.summary ?? (textParts.join("\n") || "Done."),
    assets: createdAssets,
    variables: ctx.variables,
    toolCallsExecuted,
  };
}

export type { AttachmentInput };
