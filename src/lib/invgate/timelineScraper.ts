import { getCachedInvgateWebCookie, refreshInvgateWebSession } from "./webSession";

export type InvgateTimelineEntryKind = "comment" | "private_note" | "solution" | "log";

export interface InvgateTimelineEntry {
  kind: InvgateTimelineEntryKind;
  timestamp: number;
  dateStr: string;
  author?: string;
  text: string;
}

function getInvgateWebBase(): string {
  const raw =
    process.env.INVGATE_BASE_URL ||
    (typeof import.meta !== "undefined" ? (import.meta.env as any)?.INVGATE_BASE_URL : "") ||
    "";
  return raw.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
}

function cleanHtmlFragment(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

export function isInvgateLoginPage(html: string): boolean {
  if (!html) return true;
  return (
    html.includes('id="form_login"') ||
    html.includes('action="/auth/login/type/servicedesk"') ||
    html.includes('data-login-type="azure"')
  );
}

export function isRelevantTimelineLog(text: string): boolean {
  const t = text.toLowerCase();

  // Descartar ruido operativo que no aporta evidencia a las rúbricas de calidad:
  if (
    t.includes("cambió el estado de espera") ||
    t.includes("cambió el estado de ") ||
    t.includes("solicitó la confirmación de solución") ||
    t.includes("marcó respuesta") ||
    t.includes("agregó sla") ||
    t.includes("agregó el acuerdo de nivel de servicio") ||
    t.includes("asignó a ") && t.includes("como agente") ||
    t.includes("desasignó a ") && t.includes("como agente") ||
    t.includes("marcó como leído") ||
    t.includes("vio la solicitud")
  ) {
    return false;
  }

  return true;
}

/**
 * Extrae todos los comentarios, notas privadas, soluciones y eventos relevantes del historial de cambios
 * de la sección #history del HTML de InvGate Service Management, ordenados cronológicamente (del más antiguo al más nuevo).
 */
export function parseInvgateTimelineHtml(html: string): InvgateTimelineEntry[] {
  const historyIdx = html.indexOf('id="history"');
  const section = historyIdx >= 0 ? html.slice(historyIdx) : html;

  const parts = section.split(/(?=<div class="activity-item\b)/);
  const entries: Array<InvgateTimelineEntry & { domOrder: number }> = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstTag = part.match(/^<div class="([^"]+)"/)?.[1] || "";

    // Ignorar el formulario de respuesta vacío y los indicadores de lectura
    if (firstTag.includes("activity-message--form") || firstTag.includes("activity-indicator")) {
      continue;
    }

    const tsNumMatch = part.match(/data-timestamp="(\d+)"/);
    const timestamp = tsNumMatch ? Number(tsNumMatch[1]) : 0;
    const switchMatch = part.match(/data-timestamp-switch="([^"]+)"/);
    const dateStr = switchMatch
      ? switchMatch[1].trim()
      : timestamp > 0
        ? new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19)
        : "";

    if (firstTag.includes("activity-log")) {
      const contentMatch = part.match(
        /<div class="activity-log__content">([\s\S]*?)<\/div>\s*<div class="activity-log__expander">/,
      );
      const text = contentMatch ? cleanHtmlFragment(contentMatch[1]) : cleanHtmlFragment(part);
      if (text && isRelevantTimelineLog(text)) {
        entries.push({
          kind: "log",
          timestamp,
          dateStr,
          text,
          domOrder: i,
        });
      }
    } else if (firstTag.includes("activity-message")) {
      const isSolution = firstTag.includes("activity-message--solution");
      const isPrivate = firstTag.includes("activity-message--private");

      const authorMatch = part.match(/<div class="activity-message__user">([\s\S]*?)<\/div>/);
      const author = authorMatch ? cleanHtmlFragment(authorMatch[1]) : "Usuario";

      const textMatch = part.match(/<div class="activity-message__text">([\s\S]*?)<\/div>/);
      const text = textMatch ? cleanHtmlFragment(textMatch[1]) : "";

      if (text) {
        entries.push({
          kind: isSolution ? "solution" : isPrivate ? "private_note" : "comment",
          timestamp,
          dateStr,
          author,
          text,
          domOrder: i,
        });
      }
    }
  }

  // En el DOM de InvGate los ítems vienen de más reciente (arriba) a más antiguo (abajo).
  // Ordenamos cronológicamente ascendente (de más antiguo a más nuevo). A igual timestamp, invertimos domOrder.
  entries.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return b.domOrder - a.domOrder;
  });

  return entries.map(({ domOrder: _, ...entry }) => entry);
}

/**
 * Obtiene la línea de tiempo unificada (comentarios + historial de cambios) de un ticket InvGate.
 * 1. Intenta primero vía HTTP fetch rápido con la cookie IGSMSESSID en caché.
 * 2. Si no hay cookie o la sesión expiró (401 / pantalla de login), renueva automáticamente vía Azure SSO y parsea.
 */
export async function fetchInvgateTicketTimeline(
  ticketId: string | number,
): Promise<InvgateTimelineEntry[]> {
  const cleanId = String(ticketId).replace("#", "").trim();
  const base = getInvgateWebBase();
  if (!base || !cleanId) return [];

  const url = `${base}/requests/show/index/id/${encodeURIComponent(cleanId)}`;
  const cachedCookie = getCachedInvgateWebCookie();

  if (cachedCookie) {
    try {
      const res = await fetch(url, {
        headers: {
          Cookie: `IGSMSESSID=${cachedCookie}`,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const html = await res.text();
        if (!isInvgateLoginPage(html)) {
          return parseInvgateTimelineHtml(html);
        }
      }
    } catch {
      // Fallback a renovación de sesión
    }
  }

  // Si no había cookie o expiró, renovar sesión vía Azure SSO
  const refreshed = await refreshInvgateWebSession(cleanId);
  if (refreshed.html && !isInvgateLoginPage(refreshed.html)) {
    return parseInvgateTimelineHtml(refreshed.html);
  }

  const retryRes = await fetch(url, {
    headers: {
      Cookie: `IGSMSESSID=${refreshed.cookie}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!retryRes.ok) return [];
  const retryHtml = await retryRes.text();
  return isInvgateLoginPage(retryHtml) ? [] : parseInvgateTimelineHtml(retryHtml);
}
