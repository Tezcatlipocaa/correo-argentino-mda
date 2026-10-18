import {
  buildTitleIndex,
  levenshtein,
  matchCanonicalTitle,
  similarity,
} from "../src/lib/workflow/title-catalog";

/**
 * Verificación del matching de títulos contra el catálogo del portal (puro).
 * Ejecución: npx tsx tests/workflow-title-catalog.test.mjs
 */

const catalog = [
  "Mosaic - No host",
  "Mosaic - Fallo de conexión al CD server",
  "Mosaic - Consulta",
  "Mosaic - Reimpresion de label",
  "Mosaic - Error runtime",
  "Label - Consulta",
  "Impresora Tickets - Configuración",
];
const index = buildTitleIndex(catalog);

const failures = [];
function check(name, condition) {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures.push(`FAIL: ${name}`);
  }
}

function match(raw) {
  return matchCanonicalTitle(raw, index);
}

check(
  "exacto devuelve el canónico con confianza 1",
  match("Mosaic - No host").canonical === "Mosaic - No host" &&
    match("Mosaic - No host").confidence === 1,
);
check(
  "'Mosaic- nohost' → 'Mosaic - No host'",
  match("Mosaic- nohost").canonical === "Mosaic - No host",
);
check(
  "'Mosaic - Nohost' (sin espacio) → 'Mosaic - No host'",
  match("Mosaic - Nohost").canonical === "Mosaic - No host",
);
check(
  "'Mosaic- Falla de conexión al CDserver' → '… Fallo de conexión al CD server'",
  match("Mosaic- Falla de conexión al CDserver").canonical ===
    "Mosaic - Fallo de conexión al CD server",
);
check(
  "'Mosaic- Reimpresion de label' → canónico",
  match("Mosaic- Reimpresion de label").canonical ===
    "Mosaic - Reimpresion de label",
);
check(
  "sin match seguro devuelve null",
  match("Mosaic - No imprime").canonical === null &&
    match("Algo totalmente distinto").canonical === null,
);
check(
  "no cruza de marca (Label vs Mosaic)",
  match("Label- Consulta").canonical === "Label - Consulta",
);

check(
  "levenshtein / similarity",
  levenshtein("casa", "casa") === 0 &&
    levenshtein("casa", "caza") === 1 &&
    similarity("abc", "abc") === 1 &&
    similarity("abc", "abd") > 0.6,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-title-catalog: all checks passed");
