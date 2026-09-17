/**
 * Normalización de display de los casos (tickets hijos) del workflow de
 * automatización de sucursal.
 *
 * El stepLabel crudo (texto previo al primer " - ") suele ser la referencia de
 * sucursal/automatización ("AUTSUC #79867", "AUTOMATICACIÓN DE SUCURSAL
 * B0174 SAN ANTONIO DE PADUA"), no la gestión. Este módulo deriva una etiqueta
 * amigable desde el requisito observado en el título:
 *
 * - parte el título por el separador "-" (con o sin espacios),
 * - descarta los segmentos que son referencia de sucursal/automatización,
 * - quita prefijos ordinales/jerárquicos ("1°er", "1.1-"),
 * - normaliza casing a sentence case preservando acrónimos,
 * - cae al stepLabel/título crudo si no queda ningún requisito.
 *
 * Validado con títulos reales de producción (2026-09: 12 padres, 201 hijos):
 * tanto el formato viejo/manual ("AUTOMATICACIÓN DE SUCURSAL B0174 … -
 * SOLICITUD DE EQUIPAMIENTO") como el workflow AUTSUC nuevo ("AUTSUC #79867 -
 * 1.1-Equipamiento - Server").
 */

import { cleanInvGateTitle } from "./branch-title";

/** Separador de segmentos: InvGate mezcla "A - B", "A- B" y "A -B". */
const SEGMENT_SEPARATOR_RE = /\s*-\s+/;

/**
 * Referencia de sucursal/automatización dentro de un segmento: "AUTSUC #123",
 * "AUTOMATIZACIÓN DE SUCURSAL B0174 …", "Automatización SUC B0097", "B1618
 * TRISTAN SUAREZ", "Sucursal B0022". Se evalúa normalizada (sin acentos/case)
 * para cubrir también los typos reales ("AUTOMATICACIÓN", "AUTOMATICAZIÓN").
 */
const BRANCH_REFERENCE_RE =
  /(autsuc|automatizaci[oó]n|automatizaci[oó]n(?:es)?\s+de\s+suc|sucursal\s+b?\d+|suc\s*#?\s*b?\d+|b\d{4})/;

/** Marcadores ordinales iniciales ("1°", "1°er", "2º", "2DA", "1ro"). */
const LEADING_ORDINAL_RE =
  /^\s*\d+\s*[°º](?:\s*(?:er|ro|do|to|vo|da))?\s*|^\s*\d+\s*(?:er|ro|do|to|vo|da)\b\.?\s*|^\s*\d+\s+/i;

/** Prefijo jerárquico del workflow AUTSUC: "1-", "1.1-". */
const LEADING_HIERARCHY_RE = /^\s*\d+(?:\.\d+)*[-\s]+\s*/;

/** Acrónimos que se preservan en mayúsculas al normalizar casing. */
const PRESERVED_ACRONYMS = new Set([
  "HH",
  "QR",
  "CAI",
  "PDV",
  "IP",
  "NIS",
  "PAQ",
  "SOP",
  "BUI",
  "VDI",
  "GDI",
  "TI",
  "SUC",
  "M&F",
]);

/** Nombres propios/sistemas con casing canónico conocido. */
const PROPER_NOUNS = new Map([
  ["MOSAIC", "Mosaic"],
  ["ONBASE", "OnBase"],
  ["OFFICETRACK", "OfficeTrack"],
  ["INTEGRA", "INTEGRA"],
]);

function stripDiacritics(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR");
}

/**
 * Segmento que solo aporta la referencia de sucursal/automatización (no el
 * requisito). Un segmento con la palabra "automatización" pero con contenido
 * propio igual se descarta: el requisito real vive en los demás segmentos
 * (fallback al stepLabel si todos se descartan).
 */
export function isBranchReferenceSegment(segment: string): boolean {
  return BRANCH_REFERENCE_RE.test(stripDiacritics(segment));
}

function stripLeadingOrdinalAndHierarchy(segment: string): string {
  let value = segment.trim();
  // Jerarquía primero ("1-Equipamiento", "1.1-Equipamiento"); si no aplica,
  // el ordinal suelto ("1°er Configuración", "2DA CONFIGURACIÓN").
  const withoutHierarchy = value.replace(LEADING_HIERARCHY_RE, "");
  value = withoutHierarchy !== value ? withoutHierarchy : value;
  value = value.replace(LEADING_ORDINAL_RE, "");
  return value.trim();
}

/**
 * Sentence case: las palabras TODO-MAYÚSCULAS se pasan a minúscula (salvo
 * acrónimos y nombres propios conocidos) y se capitaliza solo la primera
 * letra del resultado. Las palabras ya mixtas ("Mosaic", "OnBase",
 * "OfficeTrack", "Central") se preservan tal cual. No inventa tildes: solo
 * normaliza mayúsculas/minúsculas.
 */
export function normalizeDisplayCase(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const normalized = words.map((word) => {
    const upper = word.toLocaleUpperCase("es-AR");
    const isAllCaps = word === upper && /[A-ZÁÉÍÓÚÑ]/.test(word);

    if (!isAllCaps) {
      return word;
    }
    const proper = PROPER_NOUNS.get(upper);
    if (proper) {
      return proper;
    }
    if (PRESERVED_ACRONYMS.has(upper)) {
      return upper;
    }
    return word.toLocaleLowerCase("es-AR");
  });

  const joined = normalized.join(" ");
  return joined.length > 0
    ? joined.charAt(0).toLocaleUpperCase("es-AR") + joined.slice(1)
    : joined;
}

/** Divide el título limpio en segmentos no vacíos. */
export function splitTitleSegments(cleanedTitle: string): string[] {
  return cleanedTitle
    .split(SEGMENT_SEPARATOR_RE)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Limpia puntuación de borde que InvGate arrastra al final del título. */
function stripTrailingPunctuation(text: string): string {
  return text.replace(/[\s.;:,]+$/, "").trim();
}

/**
 * Etiqueta display de un caso. `stepLabel` es el fallback cuando el título no
 * aporta requisito (p. ej. "Instalaciones para AUTSUC #…", que es formulario).
 */
export function resolveNodeDisplayLabel(
  rawTitle: string,
  stepLabel: string,
): string {
  const cleanedTitle = cleanInvGateTitle(rawTitle || "");
  const segments = splitTitleSegments(cleanedTitle);

  const requirementSegments = segments.filter(
    (segment) => !isBranchReferenceSegment(segment),
  );

  if (requirementSegments.length === 0) {
    const fallback = stripTrailingPunctuation(
      cleanInvGateTitle(stepLabel || cleanedTitle),
    );
    return fallback.length > 0 ? fallback : cleanedTitle;
  }

  const label = requirementSegments
    .map(stripLeadingOrdinalAndHierarchy)
    .filter(Boolean)
    .join(" - ");

  const trimmed = stripTrailingPunctuation(label);
  return trimmed.length > 0 ? normalizeDisplayCase(trimmed) : cleanedTitle;
}
