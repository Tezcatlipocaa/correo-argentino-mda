import { eq } from "drizzle-orm";
import { db } from "@/db";
import { automationClosures } from "@/db/schema";
import { getServerEnv } from "@lib/invgate/automation/env";
import { isActiveStatus } from "./automation-status";
import { nowSeconds } from "./time";

/**
 * Cierres locales de automatizaciones. El portal puede marcar un caso como
 * finalizado sin tocar InvGate (donde el padre puede seguir Abierto). La fila
 * es única por automatización; reabrir = borrarla.
 */
export type AutomationClosureKind = "manual" | "auto";

export interface AutomationClosure {
  automationId: number;
  kind: AutomationClosureKind;
  reason: string;
  percent: number;
  closedBy: string;
  /** Epoch en SEGUNDOS (mismo formato que los timestamps de InvGate). */
  closedAt: number;
}

/** Motivo por defecto del cierre manual (editable en el modal). */
export const DEFAULT_CLOSE_REASON = "Se cierra con tickets pendientes";

/** Motivo del cierre automático al completar el flujo. */
export const AUTO_CLOSE_REASON = "Flujo completado al 100% (cierre automático)";

const DEFAULT_CLOSE_THRESHOLD = 80;

/**
 * Umbral de progreso para habilitar el cierre manual. Configurable por env
 * (`AUTOMATION_CLOSE_THRESHOLD`); por defecto 80.
 */
export function getCloseThreshold(): number {
  const raw = Number.parseInt(getServerEnv("AUTOMATION_CLOSE_THRESHOLD"), 10);
  if (Number.isInteger(raw) && raw >= 0 && raw <= 100) {
    return raw;
  }
  return DEFAULT_CLOSE_THRESHOLD;
}

/** El progreso alcanzó el umbral para que un admin pueda cerrar el caso. */
export function canManualClose(percent: number): boolean {
  return percent >= getCloseThreshold();
}

type ClosureRow = typeof automationClosures.$inferSelect;

function rowToClosure(row: ClosureRow): AutomationClosure {
  return {
    automationId: row.automationId,
    kind: row.kind === "auto" ? "auto" : "manual",
    reason: row.reason,
    percent: row.percent,
    closedBy: row.closedBy,
    closedAt: row.closedAt,
  };
}

/** Todos los cierres indexados por id (lectura barata: pocas filas). */
export function listClosures(): Map<number, AutomationClosure> {
  try {
    const rows = db.select().from(automationClosures).all();
    return new Map(rows.map((row) => [row.automationId, rowToClosure(row)]));
  } catch {
    return new Map();
  }
}

export function getClosure(automationId: number): AutomationClosure | null {
  try {
    const row = db
      .select()
      .from(automationClosures)
      .where(eq(automationClosures.automationId, automationId))
      .get();
    return row ? rowToClosure(row) : null;
  } catch {
    return null;
  }
}

export interface RecordClosureInput {
  automationId: number;
  kind: AutomationClosureKind;
  reason: string;
  percent: number;
  closedBy: string;
}

export function recordClosure(input: RecordClosureInput): AutomationClosure {
  const closure: AutomationClosure = {
    ...input,
    closedAt: nowSeconds(),
  };

  db.insert(automationClosures)
    .values(closure)
    .onConflictDoUpdate({
      target: automationClosures.automationId,
      set: {
        kind: closure.kind,
        reason: closure.reason,
        percent: closure.percent,
        closedBy: closure.closedBy,
        closedAt: closure.closedAt,
      },
    })
    .run();

  return closure;
}

export function removeClosure(automationId: number): void {
  db.delete(automationClosures)
    .where(eq(automationClosures.automationId, automationId))
    .run();
}

export interface AutoCloseContext {
  statusId: number;
  percent: number;
  missingBlockingCount: number;
  hasClosure: boolean;
}

/**
 * Cierre automático: el flujo llegó al 100%, no faltan etapas bloqueantes,
 * el padre sigue activo en InvGate y todavía no hay cierre local.
 */
export function shouldAutoClose(context: AutoCloseContext): boolean {
  if (context.hasClosure) {
    return false;
  }
  if (!isActiveStatus(context.statusId)) {
    return false;
  }
  if (context.percent < 100) {
    return false;
  }
  if (context.missingBlockingCount > 0) {
    return false;
  }
  return true;
}
