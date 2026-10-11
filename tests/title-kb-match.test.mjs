import {
  significantTokens,
  kbMatchScore,
  pickBestKbArticle,
} from "../src/lib/titles/kbMatch";

/**
 * Matching título ↔ artículo de KB (puro).
 * Ejecución: npx tsx tests/title-kb-match.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) console.log(`ok - ${name}`);
  else failures.push(`FAIL - ${name}`);
};

check(
  "tokens significativos ignoran conectores y cortos",
  JSON.stringify(significantTokens("Boca de red - Habilitación")) ===
    JSON.stringify(["boca", "red", "habilitacion"]),
);

check(
  "score 1 cuando todos los tokens coinciden",
  kbMatchScore("Boca de red", "Boca de red - guía") === 1,
);

check(
  "score parcial (2 de 3 tokens del título)",
  Math.abs(kbMatchScore("Boca de red cable", "Boca de red") - 2 / 3) < 0.001,
);

check("score 0 sin tokens útiles", kbMatchScore("de la", "cualquier cosa") === 0);

const articles = [
  { id: 10, title: "Configuración de Celular" },
  { id: 11, title: "Boca de red - Habilitación" },
  { id: 12, title: "Impresora" },
];

const best = pickBestKbArticle(
  "Boca de red - Habilitación",
  articles,
  0.6,
);
check(
  "elige el mejor artículo por score",
  best?.id === 11 && best?.score === 1,
);

const none = pickBestKbArticle("Tema inexistente zzz", articles, 0.6);
check("null cuando nada supera el umbral", none === null);

// Conservador: sin fallback por prefijo. Un servicio de una palabra no debe
// matchear cualquier artículo que empiece igual.
check(
  "sin match por prefijo laxo ('Mosaic - Error X' vs 'Mosaic- Otro')",
  pickBestKbArticle(
    "Mosaic - El viejo proceso de firefox",
    [{ id: 3, title: "Mosaic- Fallo de conexión al cd server" }],
    0.9,
  ) === null,
);
check(
  "umbral alto exige cobertura total",
  pickBestKbArticle("Boca de red", articles, 0.9)?.id === 11,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("title-kb-match: all checks passed");
