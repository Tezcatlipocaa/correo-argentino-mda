const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  raquo: "»",
  laquo: "«",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  uuml: "ü",
  ntilde: "ñ",
  Ntilde: "Ñ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

function decodeEntitiesOnce(input: string): string {
  return input
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(
      /&#(\d+);/g,
      (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(
      /&([a-zA-Z][a-zA-Z0-9]*);/g,
      (match, name: string) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

/**
 * Convierte el HTML de comentarios/formularios de InvGate a texto plano
 * seguro. El resultado se renderiza SIEMPRE como texto (nodo de texto),
 * nunca como HTML — es la barrera anti-XSS: los tags se eliminan y las
 * entidades se decodifican hasta estabilizar (los mensajes vienen con doble escape).
 */
export function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|ul|ol|li)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");

  let current = stripped;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = decodeEntitiesOnce(current);
  }

  return current
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
