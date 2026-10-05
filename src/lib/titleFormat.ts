/**
 * Normaliza el formato del nombre de un título: el guion separador
 * ("Servicio - Incidente") debe quedar con exactamente un espacio de cada lado.
 *
 * Regla guardada para no romper palabras compuestas:
 * - Si hay espacio a algún lado del guion ("red- X" / "red -X"), se normaliza a " - ".
 * - Si no hay espacios ("X-Y"), solo se normaliza cuando el carácter previo es
 *   mayúscula o dígito (acrónimo, p. ej. "MFA-Consulta"). Así "Wi-Fi"/"E-mail"
 *   se preservan.
 *
 * Idempotente: un nombre ya correcto no cambia.
 */
/** Guion con espacio a algún lado (o faltante): se normaliza a " - ". */
const SPACED_HYPHEN_RE = /(\S)(\s*)-(\s*)(\S)/g;
/** "MFA-Consulta": token izquierdo TODO mayúscula/dígito (>=2) → acrónimo. */
const ACRONYM_HYPHEN_RE = /(?<![A-Za-z])([A-Z0-9]{2,})-(?=\S)/g;

export function normalizeTitleName(raw: string): string {
  return raw
    .replace(
      SPACED_HYPHEN_RE,
      (
        match,
        before: string,
        leftSpace: string,
        rightSpace: string,
        after: string,
      ) =>
        leftSpace.length > 0 || rightSpace.length > 0
          ? `${before} - ${after}`
          : match,
    )
    .replace(ACRONYM_HYPHEN_RE, "$1 - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Sentence case del lado derecho del guion (el izquierdo queda intacto: suele
 * ser la marca/área, p.ej. "GYT", "MS Teams"). Primera palabra capitalizada,
 * resto en minúscula, preservando acrónimos, nombres propios y el contenido
 * entre paréntesis (p. ej. "Cierre - CDD (Nombre de Sitio/Depto)").
 * Idempotente.
 */
const PRESERVED_ACRONYMS = new Set([
  "RED",
  "WIFI",
  "USB",
  "IP",
  "IPS",
  "DNS",
  "ODBC",
  "ORACLE",
  "QR",
  "PDF",
  "TXT",
  "CD",
  "SMB1",
  "NETFRAMEWORK",
  "CDD",
  "CDE",
  "CDS",
  "STS",
  "STSPROD",
  "TTSPROD",
  "TCL",
  "SIE",
  "DESA",
  "D1",
  "ML",
  "GPG",
  "WEB",
  "CN65",
  "SO",
  "OT",
  "WIFI",
  "BUI",
  "VPN",
  "SAP",
  "SOP",
  "GPS",
  "PIN",
  "URL",
  "PC",
  "HH",
  "GYT",
  "MFA",
  "EI",
  "DTD",
  "W10",
  "W11",
  "CAI",
  "PDV",
  "NIS",
  "PAQ",
  "VDI",
  "GDI",
  "TI",
  "SUC",
  "TECO",
  "HW",
  "M&F",
  "SLA",
  "XML",
  "JSON",
  "API",
  "OK",
]);

const PROPER_NOUNS = new Map<string, string>([
  ["MOSAIC", "Mosaic"],
  ["ONBASE", "OnBase"],
  ["OFFICETRACK", "OfficeTrack"],
  ["INTEGRA", "INTEGRA"],
  ["BITLOCKER", "BitLocker"],
  ["FRAMA", "Frama"],
  ["ESET", "Eset"],
  ["BOBS", "Bobs"],
  ["CDS_TIME_OUT", "CDS_TIME_OUT"],
  ["CRADDLE", "Craddle"],
  ["SCANNER", "Scanner"],
]);

function sentenceCaseWord(word: string, isFirst: boolean): string {
  const upper = word.toLocaleUpperCase("es-AR");
  const proper = PROPER_NOUNS.get(upper);
  if (proper) return proper;
  // Acrónimos (siempre en mayúscula) y nombres propios se preservan.
  if (PRESERVED_ACRONYMS.has(upper)) return upper;

  const lower = word.toLocaleLowerCase("es-AR");
  return isFirst
    ? lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1)
    : lower;
}

/** Sentence case preservando los tramos entre paréntesis sin tocar. */
function sentenceCaseSegment(segment: string): string {
  const parts = segment.split(/(\([^)]*\))/g);
  const result: string[] = [];
  let firstDone = false;
  for (const part of parts) {
    if (part.startsWith("(")) {
      result.push(part);
      continue;
    }
    result.push(
      part
        .split(/(\s+)/)
        .map((token) => {
          if (/^\s+$/.test(token) || token.length === 0) return token;
          const isFirst = !firstDone;
          firstDone = true;
          return sentenceCaseWord(token, isFirst);
        })
        .join(""),
    );
  }
  return result.join("");
}

export function applyTitleCase(raw: string): string {
  const sep = " - ";
  const index = raw.indexOf(sep);
  if (index < 0) {
    return raw;
  }
  const left = raw.slice(0, index);
  const right = raw.slice(index + sep.length);
  return `${left}${sep}${sentenceCaseSegment(right)}`;
}

/**
 * Diccionario curado de palabras que llevan tilde (por palabra completa). Se
 * aplica respetando la mayúscula inicial. Lista explícita: no inventa tildes.
 */
const ACCENT_WORDS: Readonly<Record<string, string>> = {
  instalacion: "instalación",
  configuracion: "configuración",
  actualizacion: "actualización",
  revision: "revisión",
  telefono: "teléfono",
  activacion: "activación",
  conexion: "conexión",
  autenticacion: "autenticación",
  habilitacion: "habilitación",
  analisis: "análisis",
  operacion: "operación",
  aplicacion: "aplicación",
  reparacion: "reparación",
  validacion: "validación",
  sincronizacion: "sincronización",
  notificacion: "notificación",
  resolucion: "resolución",
  direccion: "dirección",
  codigo: "código",
  practica: "práctica",
  escaner: "escáner",
  buzon: "buzón",
  modulos: "módulos",
  numero: "número",
  credito: "crédito",
  debito: "débito",
  impresion: "impresión",
  transmision: "transmisión",
  version: "versión",
  condicion: "condición",
  funciones: "funciones",
  segmentacion: "segmentación",
  ubicacion: "ubicación",
  duplicacion: "duplicación",
  ejecucion: "ejecución",
  informacion: "información",
  autorizacion: "autorización",
  migracion: "migración",
  asignacion: "asignación",
  impresora: "impresora",
  camara: "cámara",
  estadisticas: "estadísticas",
  sincronico: "sincrónico",
  automatico: "automático",
  basico: "básico",
  publico: "público",
  ultimo: "último",
  proximo: "próximo",
  generico: "genérico",
  logico: "lógico",
  estadistico: "estadístico",
  mecanico: "mecánico",
  tecnico: "técnico",
  tecnica: "técnica",
  tecnologia: "tecnología",
  categoria: "categoría",
  biometria: "biometría",
  energia: "energía",
  papeleria: "papelería",
  mayusculas: "mayúsculas",
  minusculas: "minúsculas",
  acentos: "acentos",
  transaccion: "transacción",
  identificacion: "identificación",
  verificacion: "verificación",
  generacion: "generación",
  comunicacion: "comunicación",
  actualizaciones: "actualizaciones",
};

export function applyAccents(raw: string): string {
  return raw
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token.length === 0) return token;
      const match = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(.*)$/.exec(token);
      if (!match) return token;
      const word = match[1];
      const rest = match[2];
      const key = word.toLocaleLowerCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const accented = ACCENT_WORDS[key];
      if (!accented) return token;
      const isUpperFirst =
        word.charAt(0) === word.charAt(0).toLocaleUpperCase("es-AR");
      const fixed = isUpperFirst
        ? accented.charAt(0).toLocaleUpperCase("es-AR") + accented.slice(1)
        : accented;
      return fixed + rest;
    })
    .join("");
}

/** Pipeline final: espacios del guion + sentence case + acentos. */
export function formatTitleName(raw: string): string {
  return applyAccents(applyTitleCase(normalizeTitleName(raw)));
}
