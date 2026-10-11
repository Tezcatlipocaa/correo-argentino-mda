import { eq } from "drizzle-orm";
import { db } from "@/db";
import { automationManualData } from "@/db/schema";
import { nowSeconds } from "./time";

/**
 * Datos manuales de una automatización (override local sobre el formulario
 * inicial): corrección de jefe/zonal y campos operativos que no vienen de
 * InvGate (Número de contacto, Franja horaria, notas). Se edita desde el
 * portal y nunca toca InvGate. Fila única por automatización.
 */
export interface AutomationManualData {
  automationId: number;
  jefeName: string | null;
  jefeDni: string | null;
  jefeLegajo: string | null;
  jefeZonal: string | null;
  contactNumber: string | null;
  openingHours: string | null;
  notes: string | null;
  updatedBy: string;
  updatedAt: number;
}

type ManualDataRow = typeof automationManualData.$inferSelect;

function rowToData(row: ManualDataRow): AutomationManualData {
  return {
    automationId: row.automationId,
    jefeName: row.jefeName,
    jefeDni: row.jefeDni,
    jefeLegajo: row.jefeLegajo,
    jefeZonal: row.jefeZonal,
    contactNumber: row.contactNumber,
    openingHours: row.openingHours,
    notes: row.notes,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

export function getManualData(
  automationId: number,
): AutomationManualData | null {
  try {
    const row = db
      .select()
      .from(automationManualData)
      .where(eq(automationManualData.automationId, automationId))
      .get();
    return row ? rowToData(row) : null;
  } catch {
    return null;
  }
}

export interface SaveManualDataInput {
  automationId: number;
  jefeName: string | null;
  jefeDni: string | null;
  jefeLegajo: string | null;
  jefeZonal: string | null;
  contactNumber: string | null;
  openingHours: string | null;
  notes: string | null;
  updatedBy: string;
}

export function saveManualData(
  input: SaveManualDataInput,
): AutomationManualData {
  const updatedAt = nowSeconds();
  const values = { ...input, updatedAt };

  db.insert(automationManualData)
    .values(values)
    .onConflictDoUpdate({
      target: automationManualData.automationId,
      set: {
        jefeName: values.jefeName,
        jefeDni: values.jefeDni,
        jefeLegajo: values.jefeLegajo,
        jefeZonal: values.jefeZonal,
        contactNumber: values.contactNumber,
        openingHours: values.openingHours,
        notes: values.notes,
        updatedBy: values.updatedBy,
        updatedAt,
      },
    })
    .run();

  return { ...values };
}
