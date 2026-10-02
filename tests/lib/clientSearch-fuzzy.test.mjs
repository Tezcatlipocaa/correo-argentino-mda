import {
  fuzzyMatchesSearchQuery,
  fuzzyScore,
  matchesSearchQuery,
  scoreSearchFields,
} from "../../src/lib/clientSearch";

/**
 * Matcher fuzzy del buscador de automatizaciones (NIS / nombre de sucursal).
 * Comportamiento esperado: substring exacto (normalizado sin acentos/case) y,
 * como fallback, el query como subsecuencia en orden (tolera omisiones).
 *
 * Ejecución: node --import tsx tests/lib/clientSearch-fuzzy.test.mjs
 */

const failures = [];
function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

const value = "Automatización Sucursal B0168 Libertad";

check("query vacía matchea todo", fuzzyMatchesSearchQuery("", [value]) === true);
check("substring exacto", fuzzyScore("B0168", value) !== null);
check("case-insensitive", fuzzyScore("b0168", value) !== null);
check("NIS parcial", fuzzyScore("b01", value) !== null);
check("tolerante a acentos", fuzzyScore("automatizacion", value) !== null);
check("acentos en el query", fuzzyScore("mónica", "Mónica Ávila") !== null);
check("subsecuencia con omisiones", fuzzyScore("b168", value) !== null);
check(
  "substring al inicio puntúa más que uno en el medio",
  fuzzyScore("automatizacion", value) > fuzzyScore("libertad", value),
);
check("sin coincidencia devuelve null", fuzzyScore("zzzzz", value) === null);
check(
  "valor vacío no matchea query no vacía",
  fuzzyScore("nis", "") === null,
);

check(
  "fuzzyMatchesSearchQuery recorre varios valores",
  fuzzyMatchesSearchQuery("libertad", ["B0001 Otra", value]) === true,
);
check(
  "fuzzyMatchesSearchQuery sin match devuelve false",
  fuzzyMatchesSearchQuery("qqqq", ["B0001 Otra", value]) === false,
);

check(
  "matchesSearchQuery (substring) NO es fuzzy",
  matchesSearchQuery("b168", [value]) === false,
);

// scoreSearchFields: matching por campo (evita subsecuencia cruzada).
check(
  "por campo: 'padua' NO matchea 'Paso del Rey'",
  scoreSearchFields("padua", [{ value: "Paso del Rey" }]) === null,
);
check(
  "por campo: 'padua' matchea 'Padua'",
  scoreSearchFields("padua", [{ value: "Padua" }]) !== null,
);
check(
  "por campo: subsecuencia habilitada para NIS ('b168' -> 'B0168')",
  scoreSearchFields("b168", [{ value: "B0168", subsequence: true }]) !== null,
);
check(
  "por campo: subsecuencia deshabilitada por defecto",
  scoreSearchFields("b168", [{ value: "B0168 Libertad" }]) === null,
);
check(
  "por campo: 'B0174' matchea solo el NIS correcto",
  scoreSearchFields("b0174", [{ value: "B0174", subsequence: true }]) !==
    null &&
    scoreSearchFields("b0174", [
      { value: "B0103", subsequence: true },
      { value: "Otra Sucursal B0103" },
    ]) === null,
);
check(
  "por campo: el peso escala el score",
  (scoreSearchFields("abc", [{ value: "zabc", weight: 2 }]) ?? 0) >
    (scoreSearchFields("abc", [{ value: "zabc", weight: 1 }]) ?? 0),
);
check(
  "por campo: query vacía devuelve 0",
  scoreSearchFields("", [{ value: "cualquiera" }]) === 0,
);
check(
  "por campo: valor vacío no matchea",
  scoreSearchFields("nis", [{ value: "" }]) === null,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("clientSearch-fuzzy: all checks passed");
