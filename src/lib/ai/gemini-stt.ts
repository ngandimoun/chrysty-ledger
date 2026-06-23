import "server-only";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_INLINE_BYTES = 20 * 1024 * 1024;

const TRANSCRIBE_SYSTEM_INSTRUCTION =
  "Only output the transcript. No labels, quotes, timestamps, or commentary.";

const TRANSCRIBE_PROMPT = "Generate a transcript of the audio.";

export type GeminiSttConfig = {
  apiKey: string;
  model: string;
};

export function getGeminiSttConfig(): GeminiSttConfig {
  return {
    apiKey: process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || "",
    model: process.env.GEMINI_STT_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function isGeminiSttConfigured(): boolean {
  return Boolean(getGeminiSttConfig().apiKey);
}

export function requireGeminiSttConfig(): GeminiSttConfig {
  const config = getGeminiSttConfig();
  if (!config.apiKey) {
    throw new Error("GOOGLE_API_KEY is not configured.");
  }
  return config;
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function extractTranscript(payload: GeminiGenerateContentResponse): string {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("No speech detected in the recording.");
  }

  return text;
}

export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new Error("Audio file is empty.");
  }

  if (buffer.byteLength > MAX_INLINE_BYTES) {
    throw new Error("Audio file exceeds the 20 MB limit.");
  }

  const { apiKey, model } = requireGeminiSttConfig();
  const normalizedMime = mimeType.trim() || "audio/webm";
  const base64 = buffer.toString("base64");

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: TRANSCRIBE_SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: TRANSCRIBE_PROMPT },
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: base64,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Gemini transcription failed (${response.status}).`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Gemini transcription returned an empty response.");
  }

  return extractTranscript(payload);
}
