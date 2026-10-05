import { normalizeForCompare } from "@lib/workflow/labels";

/**
 * Matching de un título del portal contra artículos de la KB de InvGate.
 * Puro y testeable: no toca la red. El score es la cobertura de los tokens
 * significativos del título sobre el título del artículo (0..1).
 */

const CONNECTOR_TOKENS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "o",
  "en",
  "a",
  "al",
  "con",
  "sin",
  "por",
  "para",
  "no",
  "un",
  "una",
]);

const MIN_TOKEN_LENGTH = 3;

/** Tokens significativos (sin conectores, longitud mínima), normalizados. */
export function significantTokens(text: string): string[] {
  return normalizeForCompare(text)
    .split(/[^a-z0-9áéíóúñ]+/i)
    .map((token) => token.trim())
    .filter(
      (token) => token.length >= MIN_TOKEN_LENGTH && !CONNECTOR_TOKENS.has(token),
    );
}

function tokenMatches(nodeToken: string, targetToken: string): boolean {
  return (
    nodeToken === targetToken ||
    nodeToken.startsWith(targetToken) ||
    targetToken.startsWith(nodeToken)
  );
}

/**
 * Score de coincidencia: fracción de tokens del título presentes en el título
 * del artículo. 0 si el título no tiene tokens útiles.
 */
export function kbMatchScore(titleName: string, articleTitle: string): number {
  const titleTokens = [...new Set(significantTokens(titleName))];
  if (titleTokens.length === 0) {
    return 0;
  }
  const articleTokens = [...new Set(significantTokens(articleTitle))];
  if (articleTokens.length === 0) {
    return 0;
  }
  const matched = titleTokens.filter((tt) =>
    articleTokens.some((at) => tokenMatches(tt, at)),
  );
  return matched.length / titleTokens.length;
}

/** Umbral por defecto del match (conservador: casi exigir cobertura total). */
export const KB_MATCH_DEFAULT_THRESHOLD = 0.9;

export interface KbCandidate {
  id: number;
  title: string;
}

export interface KbBestMatch extends KbCandidate {
  score: number;
}

/**
 * Mejor artículo para un título. Match **conservador**: solo el nombre completo
 * del título contra el título del artículo (sin fallback por prefijo, que
 * generaba falsos positivos con servicios de una palabra como "Mosaic").
 * Null si ninguno alcanza el umbral.
 */
export function pickBestKbArticle(
  titleName: string,
  articles: readonly KbCandidate[],
  threshold: number,
): KbBestMatch | null {
  if (articles.length === 0) {
    return null;
  }

  let best: KbBestMatch | null = null;
  for (const article of articles) {
    const score = kbMatchScore(titleName, article.title);
    if (score > (best?.score ?? 0)) {
      best = { id: article.id, title: article.title, score };
    }
  }

  if (!best || best.score < threshold) {
    return null;
  }
  return best;
}
