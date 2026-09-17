import { escapeHtml } from "@lib/sanitize";

const HIGHLIGHT_CLASS = "rounded bg-warning/30 px-0.5 text-base-content";

type SearchValue = string | null | undefined;

interface TextRange {
  start: number;
  end: number;
}

export const normalizeSearchValue = (value: SearchValue): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const matchesSearchQuery = (
  query: SearchValue,
  values: SearchValue[],
): boolean => {
  const normalizedQuery = normalizeSearchValue(query).trim();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return (values || []).some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
};

/** Separadores que marcan inicio de palabra (para puntuar coincidencias). */
const WORD_BOUNDARY_PATTERN = /[\s\-_/·».,;:()[\]]/;

/**
 * Puntaje de coincidencia por substring normalizado. `null` = no aparece.
 * Prioriza, de mayor a menor: al inicio, tras un separador, en cualquier lado;
 * y dentro de cada caso, los valores más densos y más cercanos al inicio.
 */
const substringScore = (
  normalizedQuery: string,
  normalizedValue: string,
): number | null => {
  if (normalizedQuery.length === 0 || normalizedValue.length === 0) {
    return null;
  }

  const directIndex = normalizedValue.indexOf(normalizedQuery);
  if (directIndex < 0) {
    return null;
  }

  const atStart = directIndex === 0;
  const atBoundary =
    atStart || WORD_BOUNDARY_PATTERN.test(normalizedValue[directIndex - 1] ?? "");
  const density = normalizedQuery.length / normalizedValue.length;
  return (
    100 +
    (atStart ? 40 : atBoundary ? 25 : 0) +
    Math.round(density * 20) -
    Math.min(directIndex, 20)
  );
};

/**
 * Puntaje del query como subsecuencia en orden (tolera omisiones, p. ej.
 * "b16" → "B0168"). `null` si algún carácter no aparece en orden.
 */
const subsequenceScore = (
  normalizedQuery: string,
  normalizedValue: string,
): number | null => {
  if (normalizedQuery.length === 0 || normalizedValue.length === 0) {
    return null;
  }

  let queryIndex = 0;
  let firstMatchIndex = -1;
  for (let valueIndex = 0; valueIndex < normalizedValue.length; valueIndex++) {
    if (normalizedValue[valueIndex] !== normalizedQuery[queryIndex]) {
      continue;
    }
    if (firstMatchIndex === -1) {
      firstMatchIndex = valueIndex;
    }
    queryIndex += 1;
    if (queryIndex === normalizedQuery.length) {
      break;
    }
  }

  if (queryIndex < normalizedQuery.length) {
    return null;
  }

  const density = normalizedQuery.length / normalizedValue.length;
  return 40 + Math.round(density * 20) - Math.min(firstMatchIndex, 20);
};

/**
 * Puntaje fuzzy de una query contra un único valor (substring o subsecuencia).
 * `null` = no matchea. Devuelve `1` cuando la query está vacía.
 */
export const fuzzyScore = (
  query: SearchValue,
  value: SearchValue,
): number | null => {
  const normalizedQuery = normalizeSearchValue(query).trim();
  const normalizedValue = normalizeSearchValue(value);

  if (normalizedQuery.length === 0) {
    return 1;
  }
  if (normalizedValue.length === 0) {
    return null;
  }

  return (
    substringScore(normalizedQuery, normalizedValue) ??
    subsequenceScore(normalizedQuery, normalizedValue)
  );
};

export interface SearchField {
  value: SearchValue;
  /** Peso del campo en el score final (default 1). */
  weight?: number;
  /**
   * Habilita match por subsecuencia en este campo. Pensado para códigos
   * cortos (NIS, prettyId); en textos largos la subsecuencia genera ruido.
   */
  subsequence?: boolean;
}

/** Longitud máxima del valor para aceptar subsecuencia (evita falsos positivos). */
const SUBSEQUENCE_MAX_LENGTH = 16;

/**
 * Score fuzzy evaluando cada campo por separado y devolviendo el mejor
 * ponderado. `null` = ningún campo matchea. `0` = query vacía (match total).
 *
 * A diferencia de concatenar los campos en un solo string, evaluar por campo
 * evita los falsos positivos de la subsecuencia cruzada entre campos.
 */
export const scoreSearchFields = (
  query: SearchValue,
  fields: readonly (SearchField | SearchValue)[],
): number | null => {
  const normalizedQuery = normalizeSearchValue(query).trim();

  if (normalizedQuery.length === 0) {
    return 0;
  }

  let best: number | null = null;

  for (const rawField of fields ?? []) {
    const field: SearchField =
      typeof rawField === "object" && rawField !== null
        ? rawField
        : { value: rawField };

    const normalizedValue = normalizeSearchValue(field.value);
    if (normalizedValue.length === 0) {
      continue;
    }

    let score = substringScore(normalizedQuery, normalizedValue);
    if (
      score === null &&
      field.subsequence &&
      normalizedValue.length <= SUBSEQUENCE_MAX_LENGTH
    ) {
      score = subsequenceScore(normalizedQuery, normalizedValue);
    }

    if (score === null) {
      continue;
    }

    const weighted = score * (field.weight ?? 1);
    if (best === null || weighted > best) {
      best = weighted;
    }
  }

  return best;
};

/** Igual que `matchesSearchQuery` pero con tolerancia fuzzy (ver `fuzzyScore`). */
export const fuzzyMatchesSearchQuery = (
  query: SearchValue,
  values: SearchValue[],
): boolean => {
  const normalizedQuery = normalizeSearchValue(query).trim();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return (values || []).some((value) => fuzzyScore(query, value) !== null);
};

const getNormalizedIndexMap = (
  value: string,
): { normalizedText: string; indexMap: TextRange[] } => {
  let normalizedText = "";
  const indexMap: TextRange[] = [];
  let offset = 0;

  for (const character of value) {
    const start = offset;
    offset += character.length;

    const normalizedCharacter = normalizeSearchValue(character);
    normalizedText += normalizedCharacter;

    for (let index = 0; index < normalizedCharacter.length; index += 1) {
      indexMap.push({ start, end: offset });
    }
  }

  return { normalizedText, indexMap };
};

const getMatchRanges = (value: string, query: string): TextRange[] => {
  const normalizedQuery = normalizeSearchValue(query).trim();

  if (normalizedQuery.length === 0) {
    return [];
  }

  const { normalizedText, indexMap } = getNormalizedIndexMap(value);
  const ranges: TextRange[] = [];
  let searchIndex = normalizedText.indexOf(normalizedQuery);

  while (searchIndex >= 0) {
    const endIndex = searchIndex + normalizedQuery.length - 1;
    const startRange = indexMap[searchIndex];
    const endRange = indexMap[endIndex];

    if (startRange && endRange) {
      ranges.push({ start: startRange.start, end: endRange.end });
    }

    searchIndex = normalizedText.indexOf(
      normalizedQuery,
      searchIndex + normalizedQuery.length,
    );
  }

  return ranges;
};

export const highlightSearchTarget = (
  element: HTMLElement,
  query: SearchValue,
): void => {
  if (!element) return;
  const originalText =
    element.dataset?.originalText ?? element.textContent ?? "";

  if (!element.dataset?.originalText) {
    element.dataset.originalText = originalText;
  }

  const rawQuery = query?.trim() ?? "";

  if (rawQuery.length === 0) {
    element.textContent = originalText;
    return;
  }

  const matchRanges = getMatchRanges(originalText, rawQuery);

  if (matchRanges.length === 0) {
    element.textContent = originalText;
    return;
  }

  let highlightedText = "";
  let currentIndex = 0;

  matchRanges.forEach((range) => {
    highlightedText += escapeHtml(
      originalText.slice(currentIndex, range.start),
    );
    highlightedText += `<mark class="${HIGHLIGHT_CLASS}">${escapeHtml(
      originalText.slice(range.start, range.end),
    )}</mark>`;
    currentIndex = range.end;
  });

  highlightedText += escapeHtml(originalText.slice(currentIndex));
  element.innerHTML = highlightedText;
};

export const highlightSearchTargets = (
  root: ParentNode,
  query: SearchValue,
  selector = "[data-highlight-target]",
): void => {
  if (!root) return;
  const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));

  targets.forEach((target) => {
    highlightSearchTarget(target, query);
  });
};
