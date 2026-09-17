import { parseSucursalValue, type ParsedInitialForm, type SucursalFormDetails } from "./initial-form";

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
/** "Jefe de Sucursal Monica Avila" / "Jefe de sucursal: Monica Avila". */
const JEFE_PATTERN = /Jefe de Sucursal[:\s]*([^\n\r]+)/i;
/** Fecha programada de instalación: "día 24 sep 2026". */
const FECHA_PATTERN = /d\u00eda\s+([0-9]{1,2}\s+[a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa]{3,9}\s+[0-9]{4})/;

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
  const jefeMatch = JEFE_PATTERN.exec(text);
  const fechaMatch = FECHA_PATTERN.exec(text);

  const sucursal = sucursalMatch ? parseSucursalValue(sucursalMatch[1]) : null;
  const hasJefe = Boolean(jefeMatch);
  const hasFecha = Boolean(fechaMatch);

  if (!sucursal && !hasJefe) {
    return null;
  }

  const jefeName = hasJefe ? jefeMatch[1].trim() || null : null;

  return {
    sucursal: sucursal && parseHasContent(sucursal) ? sucursal : null,
    jefeName,
    scheduledDate: hasFecha ? fechaMatch[1].trim() : null,
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
