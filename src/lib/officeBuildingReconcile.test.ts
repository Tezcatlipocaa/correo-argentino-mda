import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReconcileOfficeRow } from "./officeBuildingReconcile";
import { groupOfficesByBuilding } from "./officeBuildingReconcile";

test("agrupa oficinas del mismo edificio escritas distinto", () => {
  const rows: ReconcileOfficeRow[] = [
    {
      id: 2,
      code: "O7840",
      name: "HURLINGHAM CENTRO DIST",
      address: "VERGARA GOBERNADOR DOCTOR VALENTIN 3443",
      provinceCode: "B",
    },
    {
      id: 1,
      code: "I1057",
      name: "HURLINGHAM CDD",
      address: "AV. GDOR V VERGARA 3443",
      provinceCode: "B",
    },
  ];

  const groups = groupOfficesByBuilding(rows);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 2);
  assert.equal(groups[0].canonical, "VERGARA GOBERNADOR DOCTOR VALENTIN 3443");
  assert.deepEqual(
    groups[0].members.map((m) => m.code),
    ["I1057", "O7840"],
  );
});

test("descarta grupos donde todas las direcciones crudas ya son iguales", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 1349", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 1349", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("no agrupa oficinas de distintas provincias aunque coincida la dirección", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 1349", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AVENIDA SAN JUAN 1349", provinceCode: "BA" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("excluye grupos donde el número de puerta no coincide", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 100", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 200", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("ignora filas sin dirección utilizable", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "   ", provinceCode: "C" },
    { id: 3, code: "A3", name: "C", address: "AV. SAN JUAN 100", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("colapsa diferencias de espacios internos al detectar variantes", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN  1349", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 1349", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("la clave del grupo identifica provincia, número y tokens", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. GDOR V VERGARA 3443", provinceCode: "B" },
    { id: 2, code: "A2", name: "B", address: "VERGARA GOBERNADOR DOCTOR VALENTIN 3443", provinceCode: "B" },
  ];

  assert.equal(groupOfficesByBuilding(rows)[0].key, "B#3443|GOBERNADOR+VALENTIN+VERGARA");
});

test("ordena grupos por cantidad de miembros y luego por clave", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "B1", name: "A", address: "AV. MITRE 300", provinceCode: "B" },
    { id: 2, code: "B2", name: "B", address: "AVENIDA MITRE 300", provinceCode: "B" },
    { id: 3, code: "C1", name: "C", address: "AV. SAN MARTIN 100", provinceCode: "C" },
    { id: 4, code: "C2", name: "D", address: "AVENIDA SAN MARTIN 100", provinceCode: "C" },
    { id: 5, code: "C3", name: "E", address: "SAN MARTIN 100", provinceCode: "C" },
    { id: 6, code: "C4", name: "F", address: "SAN MARTIN 100", provinceCode: "C" },
    { id: 7, code: "D1", name: "G", address: "AV. RIVADAVIA 200", provinceCode: "C" },
    { id: 8, code: "D2", name: "H", address: "AVENIDA RIVADAVIA 200", provinceCode: "C" },
    { id: 9, code: "D3", name: "I", address: "RIVADAVIA 200", provinceCode: "C" },
  ];

  const groups = groupOfficesByBuilding(rows);

  assert.deepEqual(
    groups.map((g) => [g.key, g.members.length]),
    [
      ["C#100|MARTIN+SAN", 4],
      ["C#200|RIVADAVIA", 3],
      ["B#300|MITRE", 2],
    ],
  );
});

test("desempata grupos del mismo tamaño por clave ascendente", () => {
  const rows: ReconcileOfficeRow[] = [
    { id: 1, code: "A1", name: "A", address: "AV. RIVADAVIA 900", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AVENIDA RIVADAVIA 900", provinceCode: "C" },
    { id: 3, code: "B1", name: "C", address: "AV. MITRE 800", provinceCode: "C" },
    { id: 4, code: "B2", name: "D", address: "AVENIDA MITRE 800", provinceCode: "C" },
  ];

  const groups = groupOfficesByBuilding(rows);

  assert.deepEqual(
    groups.map((g) => g.key),
    ["C#800|MITRE", "C#900|RIVADAVIA"],
  );
});
