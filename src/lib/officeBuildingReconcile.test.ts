import { test } from "node:test";
import assert from "node:assert/strict";
import { groupOfficesByBuilding } from "./officeBuildingReconcile";
import { buildBuildingKey, pickCanonicalAddress } from "./officeBuildingKey";

interface Row {
  id: number;
  code: string;
  name: string;
  address: string;
  provinceCode: string;
}

test("agrupa oficinas del mismo edificio escritas distinto", () => {
  const rows: Row[] = [
    {
      id: 1,
      code: "I1057",
      name: "HURLINGHAM CDD",
      address: "AV. GDOR V VERGARA 3443",
      provinceCode: "B",
    },
    {
      id: 2,
      code: "O7840",
      name: "HURLINGHAM CENTRO DIST",
      address: "VERGARA GOBERNADOR DOCTOR VALENTIN 3443",
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
  const rows: Row[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 1349", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 1349", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("no agrupa oficinas de distintas provincias aunque coincida la dirección", () => {
  const rows: Row[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 1349", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 1349", provinceCode: "BA" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("excluye grupos donde el número de puerta no coincide", () => {
  const rows: Row[] = [
    { id: 1, code: "A1", name: "A", address: "AV. SAN JUAN 100", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 200", provinceCode: "C" },
  ];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("ignora filas sin dirección", () => {
  const rows = [
    { id: 1, code: "A1", name: "A", address: "", provinceCode: "C" },
    { id: 2, code: "A2", name: "B", address: "AV. SAN JUAN 100", provinceCode: "C" },
  ] as Row[];

  assert.equal(groupOfficesByBuilding(rows).length, 0);
});

test("la clave del grupo coincide con buildBuildingKey", () => {
  const rows: Row[] = [
    { id: 1, code: "A1", name: "A", address: "AV. GDOR V VERGARA 3443", provinceCode: "B" },
    { id: 2, code: "A2", name: "B", address: "VERGARA GOBERNADOR DOCTOR VALENTIN 3443", provinceCode: "B" },
  ];

  const expected = buildBuildingKey(
    "AV. GDOR V VERGARA 3443",
    "B",
  ).key;
  assert.equal(groupOfficesByBuilding(rows)[0].key, expected);
});

test("pickCanonicalAddress elige la variante más completa", () => {
  assert.equal(
    pickCanonicalAddress(["AV. GDOR V VERGARA 3443", "VERGARA GOBERNADOR DOCTOR VALENTIN 3443"]),
    "VERGARA GOBERNADOR DOCTOR VALENTIN 3443",
  );
});
