export interface TitleMatchResult {
  matched: boolean;
  matchedTitle?: string;
  exact: boolean;
  confidence: number;
}

/**
 * Normaliza una cadena de título removiendo acentos, puntuación,
 * convirtiendo a minúsculas y colapsando espacios continuos.
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remueve tildes y diacríticos
    .replace(/[^\w\s]/g, " ")       // reemplaza guiones y puntuación por espacios
    .replace(/\s+/g, " ")           // colapsa espacios múltiples
    .trim();
}

/**
 * Valida un título de ticket contra la lista de títulos homologados.
 */
export function matchApprovedTitle(
  ticketTitle: string,
  approvedTitles: Array<string | { name: string }>,
): TitleMatchResult {
  const raw = (ticketTitle || "").trim();
  if (!raw || !Array.isArray(approvedTitles) || approvedTitles.length === 0) {
    return { matched: false, exact: false, confidence: 0 };
  }

  const normalizedInput = normalizeTitle(raw);
  if (!normalizedInput) {
    return { matched: false, exact: false, confidence: 0 };
  }

  // 1. Coincidencia exacta (case-sensitive y puntuación idéntica)
  for (const item of approvedTitles) {
    const titleName = typeof item === "string" ? item : item?.name || "";
    if (titleName.trim() === raw) {
      return {
        matched: true,
        matchedTitle: titleName,
        exact: true,
        confidence: 1.0,
      };
    }
  }

  // 2. Coincidencia normalizada (sin distinguir mayúsculas/minúsculas ni acentos)
  for (const item of approvedTitles) {
    const titleName = typeof item === "string" ? item : item?.name || "";
    if (normalizeTitle(titleName) === normalizedInput) {
      return {
        matched: true,
        matchedTitle: titleName,
        exact: false,
        confidence: 0.95,
      };
    }
  }

  return { matched: false, exact: false, confidence: 0 };
}

/**
 * Limpia y convierte texto con etiquetas HTML a texto plano legible con saltos de línea.
 */
export function cleanHtmlText(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  // Decodificar entidades hexadecimales (ej. &#xED;, &#xE9;, &#xF3;)
  text = text.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  // Decodificar entidades decimales (ej. &#237;, &#243;, &#241;)
  text = text.replace(/&#([0-9]+);/g, (_, dec) => {
    try {
      return String.fromCodePoint(parseInt(dec, 10));
    } catch {
      return "";
    }
  });

  // Entidades nombradas comunes
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
