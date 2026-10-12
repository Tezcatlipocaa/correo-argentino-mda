import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTreeMetrics } from "./metrics-engine";
import { buildCategoryTree } from "./tree-builder";
import type { RawCategoryItem } from "../../types/categories";

test("computeTreeMetrics correctly calculates metrics on a controlled fixture tree", () => {
  const items: RawCategoryItem[] = [
    { id: 1, parentId: null, name: "TI", totalTickets: 0 },
    { id: 2, parentId: 1, name: "Hardware", totalTickets: 0 },
    { id: 3, parentId: 2, name: "PC", totalTickets: 50 },
    { id: 4, parentId: 2, name: "Impresora", totalTickets: 30 },
    { id: 5, parentId: 1, name: "Software", totalTickets: 0 },
    { id: 6, parentId: 5, name: "Otros", totalTickets: 0 },
    { id: 7, parentId: 5, name: "Consulta", totalTickets: 20 },
    { id: 8, parentId: 1, name: "PC", totalTickets: 0 },
  ];

  const tree = buildCategoryTree(items, 1);
  const metrics = computeTreeMetrics(tree);

  assert.equal(metrics.totalNodes, 8);
  assert.equal(metrics.leafNodes, 5);
  assert.equal(metrics.deadNodes, 5);
  assert.equal(metrics.structuralWastePercent, 62.5);

  assert.equal(metrics.weightedAvgDepth, 3);

  assert.equal(metrics.pareto.top1, 50);
  assert.equal(metrics.pareto.top5, 100);
  assert.equal(metrics.pareto.top10, 100);
  assert.equal(metrics.pareto.top16, 100);
  assert.equal(metrics.pareto.top50, 100);

  assert.deepEqual(metrics.depthDistribution, {
    2: 0,
    3: 100,
  });

  assert.deepEqual(metrics.closureDistribution, {
    under1min: 37.4,
    from1to5min: 5.4,
    from5to15min: 3.7,
    from15to60min: 9.2,
    over60min: 34.1,
    immediatePercent: 46.5,
  });

  assert.equal(metrics.anomalies.singleChildCount, 0);
  assert.equal(metrics.anomalies.wildcardCount, 2);
  assert.equal(metrics.anomalies.homonymGroupCount, 1);
});

test("computeTreeMetrics handles single child anomaly and zero tickets edge case", () => {
  const items: RawCategoryItem[] = [
    { id: 1, parentId: null, name: "Root", totalTickets: 0 },
    { id: 2, parentId: 1, name: "SingleBranch", totalTickets: 0 },
    { id: 3, parentId: 2, name: "LeafOnly", totalTickets: 0 },
  ];

  const tree = buildCategoryTree(items, 1);
  const metrics = computeTreeMetrics(tree);

  assert.equal(metrics.totalNodes, 3);
  assert.equal(metrics.leafNodes, 1);
  assert.equal(metrics.deadNodes, 3);
  assert.equal(metrics.structuralWastePercent, 100);
  assert.equal(metrics.weightedAvgDepth, 0);
  assert.equal(metrics.pareto.top1, 0);
  assert.equal(metrics.pareto.top5, 0);
  assert.equal(metrics.anomalies.singleChildCount, 2);
  assert.equal(metrics.anomalies.wildcardCount, 0);
  assert.equal(metrics.anomalies.homonymGroupCount, 0);
  assert.deepEqual(metrics.depthDistribution, { 3: 0 });
});

test("computeTreeMetrics handles multi-level weighted depths and pareto distribution", () => {
  const items: RawCategoryItem[] = [
    { id: 1, parentId: null, name: "Root", totalTickets: 0 },
    { id: 2, parentId: 1, name: "L2_DirectLeaf", totalTickets: 40 },
    { id: 3, parentId: 1, name: "L2_Branch", totalTickets: 0 },
    { id: 4, parentId: 3, name: "L3_LeafA", totalTickets: 30 },
    { id: 5, parentId: 3, name: "L3_LeafB", totalTickets: 10 },
    { id: 6, parentId: 3, name: "L3_LeafC", totalTickets: 10 },
    { id: 7, parentId: 3, name: "L3_LeafD", totalTickets: 10 },
  ];

  const tree = buildCategoryTree(items, 1);
  const metrics = computeTreeMetrics(tree);

  assert.equal(metrics.totalNodes, 7);
  assert.equal(metrics.leafNodes, 5);
  assert.equal(metrics.deadNodes, 2);
  assert.equal(metrics.structuralWastePercent, 28.6);

  assert.equal(metrics.weightedAvgDepth, 2.6);

  assert.equal(metrics.pareto.top1, 40);
  assert.equal(metrics.pareto.top5, 100);
  assert.equal(metrics.pareto.top10, 100);
  assert.equal(metrics.pareto.top16, 100);
  assert.equal(metrics.pareto.top50, 100);

  assert.deepEqual(metrics.depthDistribution, {
    2: 40,
    3: 60,
  });
});
