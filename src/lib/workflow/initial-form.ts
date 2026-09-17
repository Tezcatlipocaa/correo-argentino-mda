import { toTitleCase } from "./branch-title";
import { normalizeForCompare } from "./labels";

/**
 * Parser del formulario inicial (primer comentario del ticket padre).
 *
 * Estructura validada en QA (tickets 317 y 309):
 *   Se genera solicitud por automatización de sucursal.
 *   Sucursal: Metro » BA » Ezeiza » TRISTAN SUAREZ - AGE GIROS (B1618) Fariña Antonio 188 (B1806CTD) CC_71025454
 *   Rango IP: 10.10.66.xxx
 *   Fecha estimada de finalización: 28 ago 2026
 *   Datos del jefe de sucursal:
 *   Nombre: Elsa Pato / DNI: ... / Legajo: ...
 *
 * Otros padres usan otra plantilla sin estos campos (tickets 299, 259);
 * en ese caso parseInitialForm devuelve null y la UI muestra el texto crudo.
 * El parser nunca lanza: ante formatos no reconocidos degrada a null/valores crudos.
 */

export interface InitialFormField {
  label: string;
  value: string;
}

export interface SucursalFormDetails {
  /** Nombre del sitio en Title Case (p.ej. "Tristan Suarez"). */
  name: string | null;
  /** Tramos de jerarquía previos a la localidad (p.ej. "Metro » BA"). */
  region: string | null;
  /** Tramo de localidad/partido, penúltimo de la jerarquía (p.ej. "Ezeiza"). */
  locality: string | null;
  /** Dirección física entre el código de sucursal y el CPA (p.ej. "Fariña Antonio 188"). */
  address: string | null;
  /** CPA sin la letra de provincia inicial (p.ej. "1806CTD" desde "(B1806CTD)"). */
  cpa: string | null;
  /** Valor crudo del campo, para fallback de presentación. */
  raw: string;
}

export interface JefeFormDetails {
  name: string | null;
  dni: string | null;
  legajo: string | null;
  /** Campos adicionales del formulario (p.ej. "Número de contacto"). */
  extras: InitialFormField[];
}

export interface ParsedInitialForm {
  intro: string[];
  sucursal: SucursalFormDetails | null;
  ipRange: string | null;
  estimatedEnd: string | null;
  jefe: JefeFormDetails | null;
  /** Nombre del jefe zonal (initial field del workflow AUTSUC). */
  jefeZonal: string | null;
  otherFields: InitialFormField[];
}

const FIELD_LINE_PATTERN = /^([^:]{1,60}):\s*(.*)$/;
const SECTION_HEADER_PATTERN = /^datos del jefe/;
const IP_RANGE_LABEL_PATTERN = /^rango ip(v4)?$/;

/** Sufijo de código de cliente al final del valor de sucursal; se omite en la UI. */
const CC_CODE_PATTERN = /\s*CC_\d+\s*$/i;
/** CPA argentino: letra de provincia + 4 dígitos + 3 letras (p.ej. "(B1806CTD)"). */
const CPA_PATTERN = /\((B\d{4}[A-Z]{3})\)/i;
/** Código de sucursal: paréntesis con "B" + solo dígitos (p.ej. "(B1618)"). */
const BRANCH_CODE_PATTERN = /\((B\d+)\)/i;

/**
 * Parsea el valor del campo "Sucursal":
 * "<región... » localidad » SITIO - SERVICIO (código) dirección (CPA) CC_nnn".
 * El sufijo de servicio (p.ej. "AGE GIROS") y el código CC_ se descartan.
 */
export function parseSucursalValue(rawValue: string): SucursalFormDetails {
  const value = rawValue.replaceAll("\u00a0", " ").trim();
  const segments = value
    .split("\u00bb")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const fallback: SucursalFormDetails = {
    name: null,
    region: null,
    locality: null,
    address: null,
    cpa: null,
    raw: value,
  };

  if (segments.length === 0) {
    return fallback;
  }

  const site = segments[segments.length - 1];
  const hierarchy = segments.slice(0, -1);
  const locality = hierarchy.length > 0 ? hierarchy[hierarchy.length - 1] : null;
  const region = hierarchy.length > 1 ? hierarchy.slice(0, -1).join(" \u00bb ") : null;

  const withoutCc = site.replace(CC_CODE_PATTERN, "").trim();
  const cpaMatch = CPA_PATTERN.exec(withoutCc);
  const cpa = cpaMatch ? cpaMatch[1].slice(1) : null;
  const codeMatch = BRANCH_CODE_PATTERN.exec(withoutCc);

  let address: string | null = null;
  if (codeMatch) {
    const addressStart = codeMatch.index + codeMatch[0].length;
    const addressEnd = cpaMatch ? cpaMatch.index : withoutCc.length;
    address = withoutCc.slice(addressStart, addressEnd).trim() || null;
  }

  const nameSource = codeMatch
    ? withoutCc.slice(0, codeMatch.index)
    : cpaMatch
      ? withoutCc.slice(0, cpaMatch.index)
      : withoutCc;
  const serviceSeparatorIndex = nameSource.indexOf(" - ");
  const rawName = (
    serviceSeparatorIndex !== -1
      ? nameSource.slice(0, serviceSeparatorIndex)
      : nameSource
  ).trim();
  const name = rawName.length > 0 ? toTitleCase(rawName) : null;

  return { name, region, locality, address, cpa, raw: value };
}

/** Viñetas que htmlToPlainText genera desde <li> y anteponen a cada campo del formulario. */
const LEADING_BULLET_PATTERN = /^[\s\u2022\u00b7\u25aa\u25cf\u2219\u2023]+/;

export function parseInitialForm(text: string): ParsedInitialForm | null {
  const lines = text
    .replaceAll("\u00a0", " ")
    .split("\n")
    .map((line) => line.replace(LEADING_BULLET_PATTERN, "").trim())
    .filter((line) => line.length > 0);

  const intro: string[] = [];
  const otherFields: InitialFormField[] = [];
  const jefeExtras: InitialFormField[] = [];

  let sucursalRaw: string | null = null;
  let ipRange: string | null = null;
  let estimatedEnd: string | null = null;
  let jefeName: string | null = null;
  let jefeDni: string | null = null;
  let jefeLegajo: string | null = null;
  let inJefeSection = false;

  for (const line of lines) {
    const match = FIELD_LINE_PATTERN.exec(line);
    if (!match) {
      intro.push(line);
      continue;
    }

    const label = normalizeForCompare(match[1]);
    const value = match[2].trim();

    if (value.length === 0) {
      if (SECTION_HEADER_PATTERN.test(label)) {
        inJefeSection = true;
      } else {
        intro.push(line);
      }
      continue;
    }

    if (label === "sucursal") {
      sucursalRaw = value;
    } else if (IP_RANGE_LABEL_PATTERN.test(label)) {
      ipRange = value;
    } else if (label === "fecha estimada de finalizacion") {
      estimatedEnd = value;
    } else if (label === "nombre") {
      jefeName = value;
    } else if (label === "dni") {
      jefeDni = value;
    } else if (label === "legajo") {
      jefeLegajo = value;
    } else if (inJefeSection) {
      jefeExtras.push({ label: match[1].trim(), value });
    } else {
      otherFields.push({ label: match[1].trim(), value });
    }
  }

  const sucursal = sucursalRaw !== null ? parseSucursalValue(sucursalRaw) : null;
  const jefe =
    jefeName !== null ||
    jefeDni !== null ||
    jefeLegajo !== null ||
    jefeExtras.length > 0
      ? { name: jefeName, dni: jefeDni, legajo: jefeLegajo, extras: jefeExtras }
      : null;

  const hasFields =
    sucursal !== null ||
    ipRange !== null ||
    estimatedEnd !== null ||
    jefe !== null ||
    otherFields.length > 0;

  if (!hasFields) {
    return null;
  }

  return { intro, sucursal, ipRange, estimatedEnd, jefe, jefeZonal: null, otherFields };
}
