import type { AiProvider, AiEvaluationOptions } from "./types.js";
import { OpenCodeProvider } from "./opencodeProvider.js";

export function getAiProvider(options?: AiEvaluationOptions): AiProvider {
  return new OpenCodeProvider(options?.model);
}
