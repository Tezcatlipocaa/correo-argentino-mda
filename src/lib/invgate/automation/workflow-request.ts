import { invgateGet } from "@lib/invgateClient";
import type { InvgateResult } from "@/types/invgate";
import { asText, fieldText, richFieldText } from "./value-text";

/**
 * Acceso a `GET /wf.request`, el endpoint del manual que expone los pasos y
 * las variables de un workflow, incluidos los VALORES de los initial fields
 * (Jefe de Sucursal, Jefe Zonal, DNI/Legajo, etc.).
 *
 * Estado en la instancia (2026-10): el endpoint responde 200 con el permiso
 * correspondiente del usuario de API (antes devolvía 403). `getWorkflowRequest`
 * degrada a `null` ante error, así que la vista conserva el fallback (formulario
 * parseado de la prosa de `Instalaciones`) si el endpoint falla.
 */

export interface WorkflowRequestField {
  id?: number | string;
  variable_id?: string;
  field_id?: number | null;
  label?: string | null;
  type?: number | string | null;
  value?: unknown;
  value_label?: unknown;
}

export interface WorkflowRequestExecution {
  occurrence?: number;
  state?: string;
  started_at?: number | string | null;
  completed_at?: number | string | null;
  fields?: WorkflowRequestField[];
}

export interface WorkflowRequestStep {
  id?: string;
  name?: string | null;
  type?: string | null;
  state?: string | null;
  parent_step_id?: string | null;
  occurrences?: number;
  executions?: WorkflowRequestExecution[];
}

export interface WorkflowRequestVariable {
  id?: string;
  name?: string | null;
  name_source?: string | null;
  type?: string | number | null;
  field_id?: number | null;
  value?: unknown;
  value_label?: unknown;
}

export interface InvgateWorkflowRequest {
  id?: number;
  title?: string | null;
  process_id?: number | null;
  category_id?: number | null;
  steps?: WorkflowRequestStep[];
  variables?: WorkflowRequestVariable[];
  /** Variables calculadas del proceso (nombre → valor), validadas 2026-10. */
  current_variables_values?: WorkflowRequestVariable[];
  [key: string]: unknown;
}

/**
 * Devuelve el workflow request o `null` ante 404/error (nunca lanza).
 */
export async function getWorkflowRequest(
  requestId: number,
): Promise<InvgateWorkflowRequest | null> {
  const search = new URLSearchParams({ id: String(requestId) });
  const result: InvgateResult<InvgateWorkflowRequest> = await invgateGet(
    `wf.request?${search.toString()}`,
  );
  return result.ok ? result.data : null;
}

export interface WorkflowInitialFields {
  jefeName: string | null;
  jefeDni: string | null;
  jefeLegajo: string | null;
  jefeZonal: string | null;
  nis: string | null;
}

function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");
}

/**
 * Extrae los initial fields del workflow. Recorre steps → executions → fields
 * (y, como respaldo, variables) y resuelve por label normalizado:
 * - "Jefe de Sucursal" puede venir dos veces: usuario (nombre) y tabla
 *   (DNI / N° Legajo).
 * - "Jefe Zonal" y "NIS" son campos simples.
 * Nunca lanza; devuelve `null` si no encuentra ningún dato.
 */
export function parseWorkflowInitialFields(
  request: InvgateWorkflowRequest | null | undefined,
): WorkflowInitialFields | null {
  if (!request) {
    return null;
  }

  const fields: WorkflowRequestField[] = [];
  for (const step of request.steps ?? []) {
    for (const execution of step.executions ?? []) {
      for (const field of execution.fields ?? []) {
        fields.push(field);
      }
    }
  }
  for (const variable of request.variables ?? []) {
    if (variable.name) {
      fields.push({
        label: variable.name,
        value: variable.value,
        value_label: variable.value_label,
      });
    }
  }

  let jefeName: string | null = null;
  let jefeDni: string | null = null;
  let jefeLegajo: string | null = null;
  let jefeZonal: string | null = null;
  let nis: string | null = null;

  for (const field of fields) {
    const label = normalizeLabel(asText(field.label));
    if (!label) {
      continue;
    }
    const plain = richFieldText(field.value, field.value_label)
      .replace(/\u00a0/g, " ")
      .trim();
    if (!plain) {
      continue;
    }

    if (label === "jefe de sucursal") {
      const dniMatch = /DNI[^\d]*(\d{6,9})/i.exec(plain);
      const legajoMatch = /legajo[^\d]*(\d{1,10})/i.exec(plain);
      if (dniMatch || legajoMatch) {
        jefeDni = dniMatch ? dniMatch[1] : jefeDni;
        jefeLegajo = legajoMatch ? legajoMatch[1] : jefeLegajo;
        continue;
      }
      // Campo usuario: preferir un valor no numérico (nombre).
      const candidate = fieldText(field.value, field.value_label).trim();
      if (candidate && !/^\d+$/.test(candidate)) {
        jefeName = candidate;
      }
      continue;
    }

    if (label === "jefe zonal") {
      const candidate = fieldText(field.value, field.value_label).trim();
      if (candidate && !/^\d+$/.test(candidate)) {
        jefeZonal = candidate;
      }
      continue;
    }

    if (label === "nis") {
      nis = plain;
    }
  }

  if (
    jefeName === null &&
    jefeDni === null &&
    jefeLegajo === null &&
    jefeZonal === null &&
    nis === null
  ) {
    return null;
  }

  return { jefeName, jefeDni, jefeLegajo, jefeZonal, nis };
}
