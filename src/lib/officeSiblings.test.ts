import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiblingMap, siblingKey } from "./officeSiblings";

type Mini = {
  code: string;
  name: string;
  address: string;
  region: string;
  provinceCode: string;
};

const make = (
  code: string,
  name: string,
  address: string,
  region: string,
  provinceCode: string,
): Mini => ({ code, name, address, region, provinceCode });

test("siblingKey normalizes and joins address|region|province", () => {
  assert.equal(siblingKey("  2430 ", "Centro", "s"), "2430|centro|S");
  assert.equal(siblingKey("Calle 2430", "Centro", "S"), "calle 2430|centro|S");
});

test("siblingKey returns empty string when address is blank", () => {
  assert.equal(siblingKey("", "Centro", "S"), "");
  assert.equal(siblingKey("   ", "Centro", "S"), "");
});

test("buildSiblingMap groups offices sharing address+region+province", () => {
  const items: Mini[] = [
    make("S0000", "Santa Fe", "2430", "Centro", "S"),
    make("O7906", "CDD 1 Santa Fe", "2430", "Centro", "S"),
    make("I5135", "Tel Santa Fe 1", "2430", "Centro", "S"),
    make("X9999", "Otra oficina", "Otra 12", "Centro", "S"),
  ];
  const map = buildSiblingMap(items);
  assert.equal(map.get("S0000")?.length, 2);
  assert.equal(map.get("O7906")?.length, 2);
  assert.equal(map.get("I5135")?.length, 2);
  assert.deepEqual(
    map.get("S0000")?.map((s) => s.code).sort(),
    ["I5135", "O7906"],
  );
  assert.equal(map.has("X9999"), false);
});

test("different province breaks grouping despite identical address", () => {
  const items: Mini[] = [
    make("A1", "A", "2430", "Centro", "S"),
    make("B1", "B", "2430", "Centro", "B"),
  ];
  const map = buildSiblingMap(items);
  assert.equal(map.size, 0);
});

test("an office with no sibling is omitted from the map", () => {
  const items: Mini[] = [make("SOLO", "Unica", "123", "Centro", "S")];
  const map = buildSiblingMap(items);
  assert.equal(map.has("SOLO"), false);
});
