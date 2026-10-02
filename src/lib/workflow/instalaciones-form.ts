import {
  parseSucursalValue,
  type ParsedInitialForm,
  type SucursalFormDetails,
} from "./initial-form";

/**
 * Datos de solicitud del workflow AUTSUC nuevo (producción, 2026-09, ticket
 * 79867): el padre llega con description vacía y sin comentarios; la info del
 * formulario vive en la description de los hijos vinculados titulados
 * "Instalaciones para AUTSUC #<id> ...", en prosa:
 *
 *   "Se solicita programar instalaciones para el día 24 sep 2026
 *    en Sucursal Metro » BA » Esteban Echeverria » LUIS GUILLON - SUC GIROS
 *    (B0106) Buenos Aires 1758 (B1838AHU) CC_71025399, Jefe de Sucursal
 *    Monica Avila"
 *
 * Extrae los mismos campos que parseInitialForm y nunca lanza: ante un
 * texto no reconocido devuelve null y la UI degrada (contrato compartido).
 */

/** Tramo "Sucursal <jerarquía/site ...>" hasta la coma del jefe o fin de línea. */
const SUCURSAL_PATTERN = /\bSucursal\b\s+([^,\n\r]+)/i;
/**
 * "Jefe de Sucursal Monica Avila" / "Jefe de sucursal: Monica Avila". Se corta
 * en el `#` y luego en stopwords/palabras: en el formato nuevo la prosa sigue
 * con "Detalle de equipamiento …" en la misma línea.
 */
const JEFE_LINE_PATTERN = /Jefe de Sucursal[:\s]*([^\n\r#]*)/i;
const JEFE_STOPWORDS = new Set([
  "detalle",
  "observaciones",
  "observacion",
  "descripcion",
  "horario",
  "nombre",
]);
const JEFE_MAX_WORDS = 4;
/** Fecha programada de instalación: "día 24 sep 2026". */
const FECHA_PATTERN =
  /d\u00eda\s+([0-9]{1,2}\s+[a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa]{3,9}\s+[0-9]{4})/;

/** Nombre del jefe: hasta stopword/# o 4 palabras. */
function extractJefeName(text: string): string | null {
  const match = JEFE_LINE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const words = match[1]
    .replace(/\u00a0/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const name: string[] = [];
  for (const word of words) {
    if (JEFE_STOPWORDS.has(word.toLowerCase().replace(/[.:]$/, ""))) {
      break;
    }
    name.push(word);
    if (name.length >= JEFE_MAX_WORDS) {
      break;
    }
  }
  return name.length > 0 ? name.join(" ") : null;
}

export interface InstalacionesFormInfo {
  sucursal: SucursalFormDetails | null;
  jefeName: string | null;
  scheduledDate: string | null;
}

export function parseInstalacionesDescription(
  plainText: string,
): InstalacionesFormInfo | null {
  const text = plainText.replaceAll("\u00a0", " ");
  const sucursalMatch = SUCURSAL_PATTERN.exec(text);
  const jefeName = extractJefeName(text);
  const fechaMatch = FECHA_PATTERN.exec(text);

  const sucursalInfo = sucursalMatch
    ? parseSucursalValue(sucursalMatch[1])
    : null;
  const sucursal =
    sucursalInfo && parseHasContent(sucursalInfo) ? sucursalInfo : null;
  const hasJefe = jefeName !== null;

  if (!sucursal && !hasJefe) {
    return null;
  }

  return {
    sucursal,
    jefeName,
    scheduledDate: fechaMatch ? fechaMatch[1].trim() : null,
  };
}

function parseHasContent(sucursal: SucursalFormDetails): boolean {
  return (
    sucursal.name !== null ||
    sucursal.region !== null ||
    sucursal.locality !== null ||
    sucursal.address !== null ||
    sucursal.cpa !== null
  );
}

/**
 * Convierte el resultado de Instalaciones en la estructura ParsedInitialForm
 * que consume el detalle (mismos campos: sucursal/jefe/fecha estimada).
 */
export function toParsedInitialForm(
  info: InstalacionesFormInfo,
): ParsedInitialForm {
  return {
    intro: [],
    sucursal: info.sucursal,
    ipRange: null,
    estimatedEnd: info.scheduledDate,
    jefe:
      info.jefeName !== null
        ? {
            name: info.jefeName,
            dni: null,
            legajo: null,
            extras: [],
          }
        : null,
    jefeZonal: null,
    otherFields: [],
  };
}
