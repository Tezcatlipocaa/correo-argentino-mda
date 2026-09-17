/**
 * Parser del título del ticket padre de automatización.
 *
 * Formato observado en QA (tickets 317, 309, 299, 259):
 * "Automatización de Metro » BA » Ezeiza » TRISTAN SUAREZ - AGE GIROS (B1618)
 *  Fariña Antonio 188 (B1806CTD) CC_71025454"
 *
 * - Código de sucursal: paréntesis con 'B' + solo dígitos; los códigos postales
 *   (p.ej. B1806CTD) contienen letras y NO matchean.
 * - Nombre de sucursal: último tramo de jerarquía '»' antes del primer guion,
 *   normalizado a Title Case sin mapa manual de tildes (decisión de producto).
 * - displayName: etiqueta fija "Automatización Sucursal <código> <nombre>".
 *   Si algo no matchea, hace fallback al título crudo (los títulos son datos;
 *   el parser nunca debe romper la UI).
 */

import { normalizeForCompare } from "./labels";

export interface AutomationBranchInfo {
  branchCode: string | null;
  branchName: string | null;
  displayName: string;
}

/**
 * Limpieza de presentación validada con tickets reales de QA y producción:
 * elimina separadores zero-width (\u200b), decodifica entidades HTML observadas
 * y recorta espacios de borde (padres de producción traen títulos con
 * espacios iniciales, p.ej. ticket 77759).
 */
export function cleanInvGateTitle(rawTitle: string): string {
  return rawTitle
    .replaceAll("\u200b", "")
    .replaceAll("&raquo;", "»")
    .trim();
}

/** Conectores gramaticales que van en minúscula dentro del nombre (regla genérica de casing). */
const TITLE_CONNECTORS = new Set(["de", "del", "la", "las", "los", "el", "y"]);

export function toTitleCase(rawName: string): string {
  return rawName
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es-AR");
      if (index > 0 && TITLE_CONNECTORS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
    })
    .join(" ");
}

/**
 * Etiqueta corta del paso: texto previo al primer separador " - " del título.
 * Validado con títulos reales donde el separador viene rodeado de espacios
 * normales o no separables (\u00a0); \s+ cubre ambos casos.
 */
export function parseStepLabel(cleanedTitle: string): string {
  const match = /^\s*(.+?)\s+-\s+/.exec(cleanedTitle);
  if (!match) {
    return cleanedTitle.trim();
  }
  return match[1].trim();
}

export function parseAutomationBranchTitle(
  cleanedTitle: string,
): AutomationBranchInfo {
  // Producción (2026-09, workflow AUTSUC): "AUTSUC Luis Guillón (B0106)
  // 2026-09-25" — código entre paréntesis, nombre previo al parentesis.
  // Histórico QA: código entre paréntesis después del nombre jerarquizado
  // ("... AGE GIROS (B1618) Fariña Antonio 188 ...").
  // Producción pre-AUTSUC: código sin paréntesis después de "sucursal"
  // ("Automatización de sucursal B0091").
  const branchCode =
    /\((B\d+)\)/.exec(cleanedTitle)?.[1] ??
    /\bsucursal\s+(B\d+)\b/i.exec(cleanedTitle)?.[1] ??
    null;

  let branchName: string | null = null;
  const lastSeparatorIndex = cleanedTitle.lastIndexOf("\u00bb");
  if (lastSeparatorIndex !== -1) {
    const trailingSegment = cleanedTitle.slice(lastSeparatorIndex + 1);
    const dashIndex = trailingSegment.indexOf("-");
    if (dashIndex !== -1) {
      const rawName = trailingSegment.slice(0, dashIndex).trim();
      if (rawName.length > 0) {
        branchName = toTitleCase(rawName);
      }
    }
  }

  if (branchName === null) {
    // Workflow AUTSUC: "AUTSUC Luis Guillón (B0106) ..." → nombre previo al
    // paréntesis del código ("AUTSUC " incluido).
    const autsucMatch = /^AUTSUC\s+(.+?)\s*\((B\d+)\)/.exec(cleanedTitle);
    if (autsucMatch) {
      branchName = toTitleCase(autsucMatch[1]);
    }
  }

  if (branchName === null && branchCode !== null) {
    // "Automatización de sucursal B0168 - Libertad" → nombre tras el guion
    // posterior al código.
    const codeIndex = cleanedTitle.indexOf(branchCode);
    const afterCode = cleanedTitle.slice(codeIndex + branchCode.length);
    const dashMatch = /^\s*-\s+(\S.*)$/.exec(afterCode);
    if (dashMatch) {
      branchName = toTitleCase(dashMatch[1].trim());
    }
  }

  let displayName: string;
  if (branchCode !== null && branchName !== null) {
    displayName = `Automatización Sucursal ${branchCode} ${branchName}`;
  } else if (branchCode !== null) {
    displayName = `Automatización Sucursal ${branchCode}`;
  } else if (branchName !== null) {
    displayName = branchName;
  } else {
    displayName = cleanedTitle;
  }

  return { branchCode, branchName, displayName };
}

/**
 * Display name final de una automatización:
 * - Títulos con nombre propio (formato QA) → parseAutomationBranchTitle.
 * - Títulos solo con código (formato producción "Automatización de
 *   sucursal B0168") + nombre obtenido de otra fuente (description del
 *   padre) → "<título> · <Nombre>" en Title Case.
 * - Sin ninguna fuente → título crudo (el parser nunca rompe la UI).
 */
export function buildAutomationDisplayName(
  cleanedTitle: string,
  fallbackBranchName: string | null,
): string {
  const info = parseAutomationBranchTitle(cleanedTitle);
  if (info.branchName !== null || fallbackBranchName === null) {
    return info.displayName;
  }
  // Dedupe (2026-09): los títulos de producción ya pueden traer el nombre
  // ("Automatización de sucursal B0168 - Libertad"); no lo repitamos si el
  // título (normalizado) ya lo menciona.
  const nameNormalized = normalizeForCompare(fallbackBranchName);
  if (nameNormalized && normalizeForCompare(cleanedTitle).includes(nameNormalized)) {
    return info.displayName;
  }
  return info.branchCode !== null
    ? `${cleanedTitle} · ${fallbackBranchName}`
    : fallbackBranchName;
}
