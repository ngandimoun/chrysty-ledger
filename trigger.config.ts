import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

const TASK_ENV_KEYS = [
  "DATABASE_URL",
  "MOONSHOT_API_KEY",
  "MOONSHOT_BASE_URL",
  "MOONSHOT_MODEL",
  "MOONSHOT_VISION_MODEL",
  "MOONSHOT_TIMEOUT_MS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_UPLOADS_BUCKET",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GEMINI_STT_MODEL",
] as const;

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_tfnpjiszkpqpvofftwda",
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      syncEnvVars(async () => {
        const vars: Record<string, string> = {};
        for (const key of TASK_ENV_KEYS) {
          const value = process.env[key];
          if (value) vars[key] = value;
        }
        return vars;
      }),
    ],
  },
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  maxDuration: 3600,
});
