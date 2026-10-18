import { test } from "node:test";
import assert from "node:assert/strict";
import { getRubricsForCriteria, parseRubricsMap } from "./rubricsLoader";

test("parseRubricsMap parsea correctamente todos los criterios con sintaxis ## criterio: <codigo>", () => {
  const map = parseRubricsMap();
  assert.ok(map.size > 0, "Debe cargar al menos un criterio");
  assert.ok(map.has("call_ticket_tipo"), "Debe contener call_ticket_tipo");
  assert.ok(map.has("call_ticket_ortografia"), "Debe contener call_ticket_ortografia");
  assert.ok(map.has("email_mda_categorizacion"), "Debe contener email_mda_categorizacion");
  assert.ok(map.has("email_mda_ortografia"), "Debe contener email_mda_ortografia");
  assert.ok(map.has("ag_analisis"), "Debe contener ag_analisis");
  assert.ok(map.has("ag_mda_ortografia"), "Debe contener ag_mda_ortografia");
});

test("getRubricsForCriteria devuelve únicamente las rúbricas solicitadas", () => {
  const rubrics = getRubricsForCriteria(["call_ticket_tipo", "call_ticket_prioridad"]);
  assert.match(rubrics, /criterio: call_ticket_tipo/);
  assert.match(rubrics, /criterio: call_ticket_prioridad/);
  assert.doesNotMatch(rubrics, /criterio: email_mda_tipo/);
  assert.doesNotMatch(rubrics, /criterio: ag_analisis/);
});

test("getRubricsForCriteria maneja códigos inexistentes o vacíos limpiamente", () => {
  const rubricsEmpty = getRubricsForCriteria([]);
  assert.equal(rubricsEmpty, "");

  const rubricsInexistent = getRubricsForCriteria(["codigo_inexistente_xyz"]);
  assert.equal(rubricsInexistent, "");
});

test("getRubricsForCriteria preserva los ejemplos y reglas de cada criterio", () => {
  const rubrics = getRubricsForCriteria(["call_ticket_tipo"]);
  assert.match(rubrics, /Regla Cumple/);
  assert.match(rubrics, /Regla No Cumple/);
  assert.match(rubrics, /Ejemplo Cumple/);
  assert.match(rubrics, /Ejemplo No Cumple/);
});

test("parseRubricsMap parsea las rúbricas de email_ y valida sus claves canónicas", () => {
  const map = parseRubricsMap();
  const emailCriteria = [
    "email_interpretacion",
    "email_redaccion",
    "email_claridad",
    "email_resolucion",
  ];

  const canonicalKeys = [
    "- **Objetivo:**",
    "- **Qué buscar en el ticket:**",
    "- **Regla Cumple (`cumple: true`):**",
    "- **Regla No Cumple (`cumple: false`):**",
    "- **Ejemplo Cumple:**",
    "- **Ejemplo No Cumple:**",
  ];

  for (const code of emailCriteria) {
    assert.ok(map.has(code), `Debe contener la rúbrica para ${code}`);
    const text = map.get(code)!;
    for (const key of canonicalKeys) {
      assert.ok(text.includes(key), `La rúbrica ${code} debe incluir la clave canónica '${key}'`);
    }
  }
});
