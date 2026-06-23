import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MOONSHOT_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
});

export type ProductionEnv = z.infer<typeof envSchema>;

let cachedEnv: ProductionEnv | null = null;

export function getProductionEnv(): ProductionEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid production environment variables: ${missing}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function assertCoreProductionEnv(): void {
  if (!process.env.VERCEL) return;
  getProductionEnv();
}

export function assertMastraProductionEnv(): void {
  if (!process.env.VERCEL) return;
  const env = getProductionEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Mastra agent workflows.");
  }
}

export function assertSpeechProductionEnv(): void {
  if (!process.env.VERCEL) return;
  const env = getProductionEnv();
  if (!env.GOOGLE_API_KEY && !env.GEMINI_API_KEY) {
    throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for speech transcription.");
  }
}

export function productionEnvErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Server configuration error.";
  return Response.json({ error: message }, { status: 503 });
}
