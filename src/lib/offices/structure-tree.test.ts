import { test } from "node:test";
import assert from "node:assert/strict";
import {
  constructOfficeStructureTree,
  isOfficeHeadquarter,
  type RawOfficeStructureRecord,
} from "./structure-tree";

const mockRecords: RawOfficeStructureRecord[] = [
  {
    code: "A0000",
    name: "SALTA CABECERA",
    type: "SUCURSAL",
    officeType: "SUCURSAL_AUTOMATIZADA",
    address: "DEAN FUNES 160",
    locality: "Salta",
    provinceCode: "A",
    provinceName: "Salta",
    regionId: "NOA",
    regionName: "Noroeste Argentino",
    regionColor: "#8b5cf6",
    totalTickets: 12,
    totalTerminals: 8,
  },
  {
    code: "A0001",
    name: "SALTA DISTRIBUCION",
    type: "CDD",
    officeType: "CDD",
    address: "DEAN FUNES 160", // Mismo edificio que A0000
    locality: "Salta",
    provinceCode: "A",
    provinceName: "Salta",
    regionId: "NOA",
    regionName: "Noroeste Argentino",
    regionColor: "#8b5cf6",
    totalTickets: 4,
    totalTerminals: 3,
  },
  {
    code: "A1052",
    name: "LA MERCED",
    type: "UNIDAD POSTAL",
    officeType: "UNIDAD POSTAL",
    address: "SAN MARTIN 450",
    locality: "La Merced",
    provinceCode: "A",
    provinceName: "Salta",
    regionId: "NOA",
    regionName: "Noroeste Argentino",
    regionColor: "#8b5cf6",
    totalTickets: 1,
    totalTerminals: 1,
  },
  {
    code: "C0000",
    name: "SEDE CENTRAL",
    type: "ADMINISTRACION",
    officeType: "ADMINISTRACION",
    address: "SARMIENTO 151",
    locality: "CABA",
    provinceCode: "C",
    provinceName: "CABA",
    regionId: "CABA",
    regionName: "CABA",
    regionColor: "#3b82f6",
    totalTickets: 25,
    totalTerminals: 40,
  },
];

test("isOfficeHeadquarter identifies headquarter codes ending in 0000", () => {
  assert.equal(isOfficeHeadquarter("A0000"), true);
  assert.equal(isOfficeHeadquarter("C0000"), true);
  assert.equal(isOfficeHeadquarter("X0000"), true);
  assert.equal(isOfficeHeadquarter("A0001"), false);
  assert.equal(isOfficeHeadquarter("A1052"), false);
  assert.equal(isOfficeHeadquarter(null), false);
  assert.equal(isOfficeHeadquarter(""), false);
});

test("constructOfficeStructureTree builds 5-level hierarchy with accurate metrics", () => {
  const tree = constructOfficeStructureTree(mockRecords);

  // Level 0: Root
  assert.equal(tree.type, "root");
  assert.equal(tree.totalOffices, 4);
  assert.equal(tree.totalTickets, 42);
  assert.equal(tree.totalTerminals, 52);
  assert.equal(tree.children.length, 2); // NOA and CABA

  // Level 1: Regions
  const noa = tree.children.find((r) => r.id === "reg-NOA");
  assert.ok(noa);
  assert.equal(noa.type, "region");
  assert.equal(noa.color, "#8b5cf6");
  assert.equal(noa.totalOffices, 3);
  assert.equal(noa.totalTickets, 17);
  assert.equal(noa.totalTerminals, 12);
  assert.equal(noa.children.length, 1); // Salta

  // Level 2: Province
  const salta = noa.children[0];
  assert.equal(salta.type, "province");
  assert.equal(salta.name, "Salta");
  assert.equal(salta.totalOffices, 3);
  assert.equal(salta.totalTickets, 17);
  assert.equal(salta.children.length, 2); // DEAN FUNES 160 y SAN MARTIN 450

  // Level 3: Buildings (DEAN FUNES 160 groups 2 offices)
  const deanFunes = salta.children.find((b) =>
    b.metadata?.address?.includes("DEAN FUNES"),
  );
  assert.ok(deanFunes);
  assert.equal(deanFunes.type, "building");
  assert.equal(deanFunes.totalOffices, 2);
  assert.equal(deanFunes.totalTickets, 16);
  assert.equal(deanFunes.totalTerminals, 11);
  assert.equal(deanFunes.children.length, 2);

  // Level 4: Offices
  const cabecera = deanFunes.children.find((o) => o.code === "A0000");
  assert.ok(cabecera);
  assert.equal(cabecera.type, "office");
  assert.equal(cabecera.isHeadquarter, true);
  assert.equal(cabecera.totalTickets, 12);
  assert.equal(cabecera.totalTerminals, 8);
  assert.equal(cabecera.children.length, 0);
});

test("constructOfficeStructureTree filters only headquarters when option enabled", () => {
  const tree = constructOfficeStructureTree(mockRecords, {
    onlyHeadquarters: true,
  });

  // Only A0000 and C0000 should remain
  assert.equal(tree.totalOffices, 2);
  assert.equal(tree.totalTickets, 37); // 12 + 25

  const noa = tree.children.find((r) => r.id === "reg-NOA");
  assert.ok(noa);
  assert.equal(noa.totalOffices, 1);

  const salta = noa.children[0];
  assert.equal(salta.totalOffices, 1);
  assert.equal(salta.children.length, 1); // Only DEAN FUNES 160

  const deanFunes = salta.children[0];
  assert.equal(deanFunes.totalOffices, 1);
  assert.equal(deanFunes.children.length, 1);
  assert.equal(deanFunes.children[0].code, "A0000");
});
