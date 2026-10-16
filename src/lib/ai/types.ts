import { z } from "zod";

export const AiVerdictSchema = z.object({
  codigo: z.string(),
  cumple: z.boolean().nullable(),
  confianza: z.number().min(0).max(1).catch(0.5),
  evidencia: z.string().catch(""),
  razonamiento: z.string().optional().catch(""),
});

export type AiVerdict = z.infer<typeof AiVerdictSchema>;

export const AiResponseSchema = z.object({
  resumen: z.string().optional().catch(""),
  resultados: z.array(AiVerdictSchema),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;

export interface AiProvider {
  name: string;
  evaluate(prompt: string): Promise<string>;
}

export interface AiEvaluationOptions {
  model?: string;
  provider?: "opencode";
}

export interface CouncilVote {
  model: string;
  cumple: boolean | null;
  confianza: number;
  evidencia: string;
  razonamiento: string;
}

export interface CouncilDebateEntry {
  codigo: string;
  criterioNombre: string;
  consenso: "directo" | "arbitrado" | "sin_oposicion" | "arbitraje_fallido";
  motivo?: "sin_evidencia" | "acuerdo_alto" | "baja_confianza" | "discrepancia_cumple" | "agente_unico";
  alphaVote?: CouncilVote;
  betaVote?: CouncilVote;
  judgeVote?: CouncilVote;
}

export interface CouncilEvaluationResult {
  model: string;
  isCouncil: true;
  resumen: string;
  verdicts: AiVerdict[];
  debate: Record<string, CouncilDebateEntry>;
}

