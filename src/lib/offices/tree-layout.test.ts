import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTreeLayout,
  getInitialCollapsedIds,
  findPathToNode,
  filterTreeByHeadquarters,
} from "../../components/oficinas/estructura/treeLayout";
import type { OfficeTreeNode } from "./structure-tree";

const sampleTree: OfficeTreeNode = {
  id: "root",
  type: "root",
  name: "Red Postal Nacional",
  totalOffices: 3,
  totalTickets: 15,
  totalTerminals: 10,
  children: [
    {
      id: "reg-NOA",
      type: "region",
      name: "Noroeste Argentino",
      color: "#8b5cf6",
      totalOffices: 2,
      totalTickets: 10,
      totalTerminals: 6,
      children: [
        {
          id: "prov-A",
          type: "province",
          name: "Salta",
          totalOffices: 2,
          totalTickets: 10,
          totalTerminals: 6,
          children: [
            {
              id: "bld-DEAN-FUNES-160",
              type: "building",
              name: "DEAN FUNES 160",
              totalOffices: 2,
              totalTickets: 10,
              totalTerminals: 6,
              children: [
                {
                  id: "off-A0000",
                  type: "office",
                  code: "A0000",
                  name: "SALTA CABECERA",
                  isHeadquarter: true,
                  totalOffices: 1,
                  totalTickets: 8,
                  totalTerminals: 4,
                  children: [],
                },
                {
                  id: "off-A0001",
                  type: "office",
                  code: "A0001",
                  name: "SALTA CDD",
                  isHeadquarter: false,
                  totalOffices: 1,
                  totalTickets: 2,
                  totalTerminals: 2,
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
      children: [],
    },
  ],
};

test("getInitialCollapsedIds leaves root and regions expanded, collapses provinces", () => {
  const collapsed = getInitialCollapsedIds(sampleTree);

  // Root and regions must NOT be collapsed
  assert.equal(collapsed.has("root"), false);
  assert.equal(collapsed.has("reg-NOA"), false);
  assert.equal(collapsed.has("reg-CABA"), false);

  // Province and deeper must be collapsed
  assert.equal(collapsed.has("prov-A"), true);
});

test("computeTreeLayout positions nodes with horizontal progression and vertical spacing", () => {
  const collapsed = getInitialCollapsedIds(sampleTree);
  const layout = computeTreeLayout(sampleTree, collapsed);

  // In initial state: root (depth 0), reg-NOA (depth 1), reg-CABA (depth 1)
  // prov-A is visible (depth 2) but its children are collapsed
  assert.ok(layout.nodes.length >= 3);

  const rootLayout = layout.nodes.find((n) => n.node.id === "root");
  assert.ok(rootLayout);
  assert.equal(rootLayout.x, 0);

  const noaLayout = layout.nodes.find((n) => n.node.id === "reg-NOA");
  assert.ok(noaLayout);
  assert.ok(noaLayout.x > rootLayout.x);

  // Connections exist between root and its children
  const rootConns = layout.connections.filter((c) => c.fromId === "root");
  assert.equal(rootConns.length, 2);
});

test("findPathToNode returns full list of ancestor IDs to reach search target", () => {
  const path = findPathToNode(sampleTree, "A0000");
  assert.deepEqual(path, ["root", "reg-NOA", "prov-A", "bld-DEAN-FUNES-160", "off-A0000"]);

  const notFound = findPathToNode(sampleTree, "NON_EXISTING");
  assert.equal(notFound, null);
});

test("filterTreeByHeadquarters keeps only headquarter nodes and prunes non-headquarter branches", () => {
  const filtered = filterTreeByHeadquarters(sampleTree);
  assert.ok(filtered);
  assert.equal(filtered.totalOffices, 1);

  const noa = filtered.children.find((r) => r.id === "reg-NOA");
  assert.ok(noa);
  const salta = noa.children[0];
  const bld = salta.children[0];
  assert.equal(bld.children.length, 1);
  assert.equal(bld.children[0].code, "A0000");
});
