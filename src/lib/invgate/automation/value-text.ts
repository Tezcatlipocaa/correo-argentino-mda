import { htmlToPlainText } from "@lib/format/html-to-text";

/**
 * Normalización de valores de campos de InvGate (incidentes y variables de
 * workflow). Compartido para no duplicar la lógica de `value_label` + HTML.
 */

export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

/** Texto legible: prefiere `value_label` salvo que sea un id numérico. */
export function fieldText(value: unknown, valueLabel: unknown): string {
  const raw = asText(value).trim();
  const label = asText(valueLabel).trim();
  return label && !/^\d+$/.test(label) ? label : raw;
}

/** Igual que `fieldText` pero convierte HTML (tablas de InvGate) a texto plano. */
export function richFieldText(value: unknown, valueLabel: unknown): string {
  const text = fieldText(value, valueLabel);
  return /<[a-z][\s\S]*>/i.test(text) ? htmlToPlainText(text) : text;
}
