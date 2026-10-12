import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCategoryTree } from "./tree-builder";
import type { RawCategoryItem } from "../../types/categories";

test("buildCategoryTree builds tree structure, depth, path, isLeaf, status, and anomalies with totalTickets and parentId", () => {
  const items: RawCategoryItem[] = [
    { id: 1, parentId: null, name: "TI", totalTickets: 50 },
    { id: 2, parentId: 1, name: "Hardware", totalTickets: 0 },
    { id: 3, parentId: 2, name: "PC", totalTickets: 250 },
    { id: 4, parentId: 1, name: "Software", totalTickets: 15 },
    { id: 5, parentId: 4, name: "Otros", totalTickets: 0 },
    { id: 6, parentId: 4, name: "Consulta", totalTickets: 10 },
  ];

  const tree = buildCategoryTree(items, 1);

  // Root validation
  assert.equal(tree.id, 1);
  assert.equal(tree.parentId, null);
  assert.equal(tree.name, "TI");
  assert.equal(tree.totalTickets, 50);
  assert.equal(tree.ticketCount, 50);
  assert.equal(tree.depth, 1);
  assert.equal(tree.path, "TI");
  assert.equal(tree.isLeaf, false);
  assert.equal(tree.status, "normal");
  assert.deepEqual(tree.anomalies, []);
  assert.equal(tree.children.length, 2);

  // Node 2 (Hardware) -> single child (Node 3), zero tickets intermediate
  const hardwareNode = tree.children.find((c) => c.id === 2);
  assert.ok(hardwareNode);
  assert.equal(hardwareNode.parentId, 1);
  assert.equal(hardwareNode.name, "Hardware");
  assert.equal(hardwareNode.totalTickets, 0);
  assert.equal(hardwareNode.depth, 2);
  assert.equal(hardwareNode.path, "TI » Hardware");
  assert.equal(hardwareNode.isLeaf, false);
  assert.equal(hardwareNode.status, "zero");
  assert.deepEqual(hardwareNode.anomalies, ["single_child"]);
  assert.equal(hardwareNode.children.length, 1);

  // Node 3 (PC) -> leaf with >=200 tickets (hot)
  const pcNode = hardwareNode.children[0];
  assert.equal(pcNode.id, 3);
  assert.equal(pcNode.parentId, 2);
  assert.equal(pcNode.name, "PC");
  assert.equal(pcNode.totalTickets, 250);
  assert.equal(pcNode.depth, 3);
  assert.equal(pcNode.path, "TI » Hardware » PC");
  assert.equal(pcNode.isLeaf, true);
  assert.equal(pcNode.status, "hot");
  assert.deepEqual(pcNode.anomalies, []);
  assert.deepEqual(pcNode.children, []);

  // Node 4 (Software) -> 2 children, normal status
  const softwareNode = tree.children.find((c) => c.id === 4);
  assert.ok(softwareNode);
  assert.equal(softwareNode.parentId, 1);
  assert.equal(softwareNode.name, "Software");
  assert.equal(softwareNode.totalTickets, 15);
  assert.equal(softwareNode.depth, 2);
  assert.equal(softwareNode.path, "TI » Software");
  assert.equal(softwareNode.isLeaf, false);
  assert.equal(softwareNode.status, "normal");
  assert.deepEqual(softwareNode.anomalies, []);
  assert.equal(softwareNode.children.length, 2);

  // Node 5 (Otros) -> leaf with 0 tickets (dead) + wildcard_name
  const otrosNode = softwareNode.children.find((c) => c.id === 5);
  assert.ok(otrosNode);
  assert.equal(otrosNode.parentId, 4);
  assert.equal(otrosNode.name, "Otros");
  assert.equal(otrosNode.totalTickets, 0);
  assert.equal(otrosNode.depth, 3);
  assert.equal(otrosNode.path, "TI » Software » Otros");
  assert.equal(otrosNode.isLeaf, true);
  assert.equal(otrosNode.status, "dead");
  assert.deepEqual(otrosNode.anomalies, ["wildcard_name"]);

  // Node 6 (Consulta) -> leaf with 10 tickets (normal) + wildcard_name
  const consultaNode = softwareNode.children.find((c) => c.id === 6);
  assert.ok(consultaNode);
  assert.equal(consultaNode.parentId, 4);
  assert.equal(consultaNode.name, "Consulta");
  assert.equal(consultaNode.totalTickets, 10);
  assert.equal(consultaNode.depth, 3);
  assert.equal(consultaNode.path, "TI » Software » Consulta");
  assert.equal(consultaNode.isLeaf, true);
  assert.equal(consultaNode.status, "normal");
  assert.deepEqual(consultaNode.anomalies, ["wildcard_name"]);
});

test("buildCategoryTree supports legacy ticketCount property as fallback", () => {
  const items: RawCategoryItem[] = [
    { id: 10, parentId: null, name: "Legacy", ticketCount: 42 },
  ];
  const tree = buildCategoryTree(items, 10);
  assert.equal(tree.id, 10);
  assert.equal(tree.totalTickets, 42);
  assert.equal(tree.ticketCount, 42);
});

test("buildCategoryTree throws error when rootId is missing", () => {
  assert.throws(() => buildCategoryTree([], 999), /Root category item with id 999 not found/);
});
