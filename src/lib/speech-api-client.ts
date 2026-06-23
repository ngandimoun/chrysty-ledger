export async function transcribeSpeech(
  audio: Blob,
  options?: { ledgerKey: string; userId?: string | null }
): Promise<string> {
  if (!options?.ledgerKey?.trim()) {
    throw new Error("Ledger is not ready.");
  }

  const formData = new FormData();
  const filename = audio.type.includes("webm") ? "recording.webm" : "recording.audio";
  formData.append("audio", audio, filename);
  formData.append("ledgerKey", options.ledgerKey);

  const response = await fetch("/api/speech/transcribe", {
    method: "POST",
    headers: {
      "x-ledger-key": options.ledgerKey,
      ...(options.userId ? { "x-ledger-user-id": options.userId } : {}),
    },
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as
    | { transcript?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body.error === "string"
        ? body.error
        : `Transcription failed (${response.status}).`;
    throw new Error(message);
  }

  const transcript = body?.transcript?.trim();
  if (!transcript) {
    throw new Error("No speech detected in the recording.");
  }

  return transcript;
}
