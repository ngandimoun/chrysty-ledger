import "server-only";

import { NextResponse } from "next/server";

import { getAssetV2 } from "@/lib/assets/service";
import { createLedgerScope, parseLedgerIdentityFromHeaders } from "@/lib/ledger/server-scope";
import { createSignedDownloadUrl } from "@/lib/storage/workspace-files";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id: workspaceId, assetId } = await context.params;
  const identity = parseLedgerIdentityFromHeaders(request);

  if (!identity) {
    return NextResponse.json({ error: "Missing x-ledger-key header." }, { status: 401 });
  }

  let scope;
  try {
    scope = createLedgerScope(identity);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ledger scope unavailable." },
      { status: 503 }
    );
  }

  const asset = await getAssetV2(scope, workspaceId, assetId);
  if (!asset || asset.kind !== "file") {
    return NextResponse.json({ error: "File asset not found." }, { status: 404 });
  }

  const storageRef = String(asset.data.storageRef ?? "");
  if (!storageRef) {
    return NextResponse.json({ error: "File has no storage reference." }, { status: 404 });
  }

  try {
    const url = await createSignedDownloadUrl(scope, storageRef);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "json") {
      return NextResponse.json({ url });
    }

    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve file URL." },
      { status: 500 }
    );
  }
}
