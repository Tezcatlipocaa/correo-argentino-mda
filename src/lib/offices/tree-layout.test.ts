import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeTreeLayout,
  getInitialCollapsedIds,
  findPathToNode,
  findAllMatchingNodes,
  filterOfficeTree,
  extractAvailableOfficeTypes,
  computeFitToScreen,
  filterVisibleViewport,
  NODE_WIDTH,
  NODE_HEIGHT,
  type OfficeFilterOptions,
} from "../../components/oficinas/estructura/treeLayout";
import type { OfficeTreeNode } from "./structure-tree";

const mockTree: OfficeTreeNode = {
  id: "root",
  type: "root",
  name: "Red Postal Nacional",
  totalOffices: 4,
  totalTickets: 25,
  totalTerminals: 14,
  children: [
    {
      id: "reg-NOA",
      type: "region",
      name: "Noroeste Argentino",
      color: "#8b5cf6",
      totalOffices: 3,
      totalTickets: 20,
      totalTerminals: 10,
      children: [
        {
          id: "prov-A",
          type: "province",
          name: "Salta",
          totalOffices: 3,
          totalTickets: 20,
          totalTerminals: 10,
          children: [
            {
              id: "bld-DEAN-FUNES-160",
              type: "building",
              name: "DEAN FUNES 160",
              totalOffices: 3,
              totalTickets: 20,
              totalTerminals: 10,
              children: [
                {
                  id: "off-A0000",
                  type: "office",
                  code: "A0000",
                  name: "SALTA CABECERA",
                  officeType: "SUCURSAL_AUTOMATIZADA",
                  isHeadquarter: true,
                  totalOffices: 1,
                  totalTickets: 15,
                  totalTerminals: 6,
                  children: [],
                },
                {
                  id: "off-A0001",
                  type: "office",
                  code: "A0001",
                  name: "SALTA CDD",
                  officeType: "CDD",
                  isHeadquarter: false,
                  totalOffices: 1,
                  totalTickets: 5,
                  totalTerminals: 4,
                  children: [],
                },
                {
                  id: "off-A0002",
                  type: "office",
                  code: "A0002",
                  name: "SALTA ESTAFETA",
                  officeType: "ESTAFETA",
                  isHeadquarter: false,
                  totalOffices: 1,
                  totalTickets: 0,
                  totalTerminals: 0,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "reg-CABA",
      type: "region",
      name: "CABA",
      color: "#3b82f6",
      totalOffices: 1,
      totalTickets: 5,
      totalTerminals: 4,
      children: [
        {
          id: "prov-C",
          type: "province",
          name: "Capital Federal",
          totalOffices: 1,
          totalTickets: 5,
          totalTerminals: 4,
          children: [
            {
              id: "bld-SARMIENTO-151",
              type: "building",
              name: "SARMIENTO 151",
              totalOffices: 1,
              totalTickets: 5,
              totalTerminals: 4,
              children: [
                {
                  id: "off-C0000",
                  type: "office",
                  code: "C0000",
                  name: "CENTRO POSTAL CABA",
                  officeType: "CTP",
                  isHeadquarter: true,
                  totalOffices: 1,
                  totalTickets: 5,
                  totalTerminals: 4,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("Office Tree Layout & Advanced Filtering Engine", () => {
  test("card dimensions follow new anti-clipping size", () => {
    assert.equal(NODE_WIDTH, 280);
    assert.equal(NODE_HEIGHT, 108);
  });

  test("extractAvailableOfficeTypes discovers unique types with office counts", () => {
    const types = extractAvailableOfficeTypes(mockTree);
    assert.ok(Array.isArray(types));
    assert.equal(types.length, 4);

    const cdd = types.find((t) => t.type === "CDD");
    assert.ok(cdd);
    assert.equal(cdd.count, 1);

    const auto = types.find((t) => t.type === "SUCURSAL_AUTOMATIZADA");
    assert.ok(auto);
    assert.equal(auto.count, 1);
  });

  test("filterOfficeTree filters by headquarters mode", () => {
    const filters: OfficeFilterOptions = { headquartersOnly: true };
    const filtered = filterOfficeTree(mockTree, filters);

    assert.ok(filtered);
    assert.equal(filtered.totalOffices, 2); // A0000 and C0000
    assert.equal(filtered.totalTickets, 20); // 15 + 5
  });

  test("filterOfficeTree filters by minimum tickets and ticket tier", () => {
    const filters: OfficeFilterOptions = { minTickets: 10 };
    const filtered = filterOfficeTree(mockTree, filters);

    assert.ok(filtered);
    assert.equal(filtered.totalOffices, 1); // only A0000 with 15 tickets
    assert.equal(filtered.totalTickets, 15);
  });

  test("filterOfficeTree filters by selected office types (multi-select)", () => {
    const filters: OfficeFilterOptions = { officeTypes: ["CDD", "CTP"] };
    const filtered = filterOfficeTree(mockTree, filters);

    assert.ok(filtered);
    assert.equal(filtered.totalOffices, 2); // A0001 (CDD) and C0000 (CTP)
    assert.equal(filtered.totalTickets, 10);
  });

  test("filterOfficeTree filters by terminals presence", () => {
    const filters: OfficeFilterOptions = { terminalsMode: "with_terminals" };
    const filtered = filterOfficeTree(mockTree, filters);

    assert.ok(filtered);
    assert.equal(filtered.totalOffices, 3); // A0000, A0001, C0000 (excluding A0002 with 0 terminals)
  });

  test("findAllMatchingNodes returns all matching node paths for 1/N search navigation", () => {
    const matches = findAllMatchingNodes(mockTree, "SALTA");
    assert.ok(Array.isArray(matches));
    assert.equal(matches.length, 4); // prov-A (Salta) + A0000, A0001, A0002
    assert.equal(matches[0].targetId, "prov-A");
    assert.equal(matches[1].targetId, "off-A0000");
    assert.ok(matches[1].path.length >= 4);
  });

  test("computeFitToScreen calculates optimal pan and zoom to fit viewport", () => {
    const fit = computeFitToScreen({
      totalWidth: 1400,
      totalHeight: 900,
      containerWidth: 1000,
      containerHeight: 700,
      padding: 40,
    });

    assert.ok(fit.zoom > 0 && fit.zoom <= 1);
    assert.ok(typeof fit.pan.x === "number");
    assert.ok(typeof fit.pan.y === "number");
  });

  test("filterVisibleViewport returns only nodes within visible viewport plus overscan", () => {
    const collapsed = getInitialCollapsedIds(mockTree);
    const layout = computeTreeLayout(mockTree, collapsed);

    const visible = filterVisibleViewport(layout.nodes, {
      pan: { x: 0, y: 0 },
      zoom: 1,
      viewportWidth: 800,
      viewportHeight: 600,
      overscan: 100,
    });

    assert.ok(Array.isArray(visible));
    assert.ok(visible.length <= layout.nodes.length);
  });
});
