import type { AiProvider, AiEvaluationOptions } from "./types.js";
import { OpenCodeProvider } from "./opencodeProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

const env = (k: string) =>
  process.env[k] ?? (import.meta.env as Record<string, string | undefined> | undefined)?.[k];

export function getAiProvider(options?: AiEvaluationOptions): AiProvider {
  const providerType = options?.provider || (env("AI_PROVIDER") as "opencode" | "gemini") || "opencode";

  if (providerType === "gemini") {
    return new GeminiProvider(undefined, options?.model);
  }

  return new OpenCodeProvider(options?.model);
}
