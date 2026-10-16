import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeCategoryTreeLayout,
  filterCategoryTree,
  findCategoryMatches,
  CATEGORY_NODE_WIDTH,
  CATEGORY_NODE_HEIGHT,
  type CategoryFilterOptions,
} from "../../components/reportes/categories/categoryTreeLayout";
import type { CategoryNode } from "@/types/categories";

const sampleCategoryTree: CategoryNode = {
  id: 1,
  parentId: null,
  name: "Mesa de Ayuda TI",
  path: "Mesa de Ayuda TI",
  depth: 0,
  totalTickets: 250,
  isLeaf: false,
  status: "normal",
  anomalies: [],
  children: [
    {
      id: 10,
      parentId: 1,
      name: "Hardware y Periféricos",
      path: "Mesa de Ayuda TI > Hardware y Periféricos",
      depth: 1,
      totalTickets: 180,
      isLeaf: false,
      status: "hot",
      anomalies: [],
      children: [
        {
          id: 101,
          parentId: 10,
          name: "Impresoras Láser",
          path: "Mesa de Ayuda TI > Hardware y Periféricos > Impresoras Láser",
          depth: 2,
          totalTickets: 120,
          isLeaf: false,
          status: "normal",
          anomalies: [],
          children: [
            {
              id: 1011,
              parentId: 101,
              name: "Falla de encendido",
              path: "Mesa de Ayuda TI > Hardware y Periféricos > Impresoras Láser > Falla de encendido",
              depth: 3,
              totalTickets: 80,
              isLeaf: true,
              status: "normal",
              anomalies: [],
              children: [],
            },
            {
              id: 1012,
              parentId: 101,
              name: "Otros problemas",
              path: "Mesa de Ayuda TI > Hardware y Periféricos > Impresoras Láser > Otros problemas",
              depth: 3,
              totalTickets: 40,
              isLeaf: true,
              status: "normal",
              anomalies: ["wildcard_name"],
              children: [],
            },
          ],
        },
        {
          id: 102,
          parentId: 10,
          name: "Escáneres",
          path: "Mesa de Ayuda TI > Hardware y Periféricos > Escáneres",
          depth: 2,
          totalTickets: 0,
          isLeaf: false,
          status: "dead",
          anomalies: ["single_child"],
          children: [
            {
              id: 1021,
              parentId: 102,
              name: "Escáner sin conexión",
              path: "Mesa de Ayuda TI > Hardware y Periféricos > Escáneres > Escáner sin conexión",
              depth: 3,
              totalTickets: 0,
              isLeaf: true,
              status: "dead",
              anomalies: [],
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: 20,
      parentId: 1,
      name: "Sistemas Corporativos",
      path: "Mesa de Ayuda TI > Sistemas Corporativos",
      depth: 1,
      totalTickets: 70,
      isLeaf: false,
      status: "normal",
      anomalies: [],
      children: [
        {
          id: 201,
          parentId: 20,
          name: "Portal MDA",
          path: "Mesa de Ayuda TI > Sistemas Corporativos > Portal MDA",
          depth: 2,
          totalTickets: 70,
          isLeaf: true,
          status: "normal",
          anomalies: [],
          children: [],
        },
      ],
    },
  ],
};

describe("Category Tree Layout & Taxonomic Filtering Engine", () => {
  test("category card dimensions follow standard size", () => {
    assert.equal(CATEGORY_NODE_WIDTH, 280);
    assert.equal(CATEGORY_NODE_HEIGHT, 108);
  });

  test("filterCategoryTree filters by minimum tickets and excludes dead branches", () => {
    const filters: CategoryFilterOptions = { minTickets: 50 };
    const filtered = filterCategoryTree(sampleCategoryTree, filters);

    assert.ok(filtered);
    assert.equal(filtered.totalTickets, 250);
    // Escáneres (0 tickets) should be pruned
    const hw = filtered.children.find((c) => c.id === 10);
    assert.ok(hw);
    assert.equal(hw.children.some((c) => c.id === 102), false);
  });

  test("filterCategoryTree filters by specific anomaly", () => {
    const filters: CategoryFilterOptions = { anomalies: ["wildcard_name"] };
    const filtered = filterCategoryTree(sampleCategoryTree, filters);

    assert.ok(filtered);
    const hw = filtered.children.find((c) => c.id === 10);
    assert.ok(hw);
    const printers = hw.children.find((c) => c.id === 101);
    assert.ok(printers);
    assert.equal(printers.children.length, 1);
    assert.equal(printers.children[0].id, 1012);
  });

  test("filterCategoryTree restricts maximum depth", () => {
    const filters: CategoryFilterOptions = { maxDepth: 2 };
    const filtered = filterCategoryTree(sampleCategoryTree, filters);

    assert.ok(filtered);
    const hw = filtered.children.find((c) => c.id === 10);
    assert.ok(hw);
    const printers = hw.children.find((c) => c.id === 101);
    assert.ok(printers);
    // At maxDepth 2, depth 3 nodes should not exist in children
    assert.equal(printers.children.length, 0);
  });

  test("findCategoryMatches returns all matches for search queries with 1/N navigation", () => {
    const matches = findCategoryMatches(sampleCategoryTree, "escáner");
    assert.ok(Array.isArray(matches));
    assert.equal(matches.length, 2); // Escáneres and Escáner sin conexión
    assert.ok(matches[0].path.length >= 2);
  });

  test("computeCategoryTreeLayout handles layout with connection curves and collapsed nodes", () => {
    const layout = computeCategoryTreeLayout(sampleCategoryTree, new Set<number>([101]));
    assert.ok(layout.nodes.length > 0);
    assert.ok(layout.connections.length > 0);
    assert.ok(layout.totalWidth > 0);
    assert.ok(layout.totalHeight > 0);

    const printerNode = layout.nodes.find((n) => n.node.id === 101);
    assert.ok(printerNode);
    assert.equal(printerNode.isCollapsed, true);
  });
});
