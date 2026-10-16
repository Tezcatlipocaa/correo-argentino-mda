import { db } from "@db/index";
import { autogestionRuleState } from "@db/schema";
import { AUTOGESTION_AUTOMATION_RULES } from "./rulesEngine";

/**
 * Estado real de habilitación de las automatizaciones de AGS.
 * Invariante: la fila de `autogestion_rule_state` manda; el `status` del catálogo
 * documental (AUTOGESTION_AUTOMATION_RULES) es únicamente el default para reglas
 * que todavía no fueron toggleadas.
 */
export async function getAutogestionRuleStates(): Promise<Map<string, boolean>> {
  const rows = await db.select().from(autogestionRuleState);
  const states = new Map<string, boolean>();
  for (const row of rows) {
    states.set(row.ruleId, Boolean(row.enabled));
  }
  return states;
}

export function resolveRuleEnabled(
  ruleId: string,
  states: Map<string, boolean>,
): boolean {
  if (states.has(ruleId)) return states.get(ruleId) as boolean;
  const docRule = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === ruleId);
  return docRule ? docRule.status === "active" : true;
}

export async function setAutogestionRuleState(
  ruleId: string,
  enabled: boolean,
  username: string,
): Promise<void> {
  const now = Date.now();
  await db
    .insert(autogestionRuleState)
    .values({ ruleId, enabled, updatedAt: now, updatedBy: username })
    .onConflictDoUpdate({
      target: autogestionRuleState.ruleId,
      set: { enabled, updatedAt: now, updatedBy: username },
    });
}
