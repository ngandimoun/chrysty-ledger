import { NextResponse } from "next/server";

import { isGeminiSttConfigured, transcribeAudio } from "@/lib/ai/gemini-stt";
import { assertCoreProductionEnv, assertSpeechProductionEnv, productionEnvErrorResponse } from "@/lib/env";
import { parseLedgerIdentityFromHeaders } from "@/lib/ledger/server-scope";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    assertCoreProductionEnv();
    assertSpeechProductionEnv();
  } catch (error) {
    return productionEnvErrorResponse(error);
  }

  if (!isGeminiSttConfigured()) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const ledgerKeyFromForm = formData.get("ledgerKey");
  const ledgerKey =
    parseLedgerIdentityFromHeaders(request)?.ledgerKey ??
    (typeof ledgerKeyFromForm === "string" ? ledgerKeyFromForm.trim() : "");

  if (!ledgerKey) {
    return NextResponse.json({ error: "Missing ledger key." }, { status: 401 });
  }

  const audioEntry = formData.get("audio");
  if (!(audioEntry instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (!audioEntry.type.startsWith("audio/")) {
    return NextResponse.json(
      { error: "Only audio files are supported." },
      { status: 400 }
    );
  }

  if (audioEntry.size === 0) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }

  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio file exceeds the 20 MB limit." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await audioEntry.arrayBuffer());
    const transcript = await transcribeAudio(buffer, audioEntry.type);
    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";

    if (message.includes("No speech detected")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
