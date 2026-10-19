import type { CategoryNode } from "../../types/categories";

export interface ParetoMetrics {
  top1: number;
  top5: number;
  top10: number;
  top16: number;
  top50: number;
}

export interface ClosureDistributionMetrics {
  under1min: number;
  from1to5min: number;
  from5to15min: number;
  from15to60min: number;
  over60min: number;
  immediatePercent: number;
}

export interface AnomaliesMetrics {
  singleChildCount: number;
  wildcardCount: number;
  homonymGroupCount: number;
}

export interface TreeMetricsResult {
  totalNodes: number;
  leafNodes: number;
  deadNodes: number;
  structuralWastePercent: number;
  weightedAvgDepth: number;
  pareto: ParetoMetrics;
  depthDistribution: Record<number, number>;
  closureDistribution: ClosureDistributionMetrics;
  /**
   * Nombres de campos cuyo valor NO proviene del árbol real (son de ejemplo).
   * La UI los rotula; se retiran cuando exista la fuente real.
   */
  demoFields: string[];
  anomalies: AnomaliesMetrics;
}

function roundTo(num: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

// Distribución de tiempos de cierre de ejemplo (no calculada del volumen real
// de tickets). Se expone en `demoFields` para que la UI la rotule.
const STATIC_CLOSURE_DISTRIBUTION: ClosureDistributionMetrics = {
  under1min: 37.4,
  from1to5min: 5.4,
  from5to15min: 3.7,
  from15to60min: 9.2,
  over60min: 34.1,
  immediatePercent: 46.5,
};

export function computeTreeMetrics(root: CategoryNode): TreeMetricsResult {
  const allNodes: CategoryNode[] = [];
  const leafNodesList: CategoryNode[] = [];
  const depthDistribution: Record<number, number> = {};
  const namesMap = new Map<string, number>();

  let singleChildCount = 0;
  let wildcardCount = 0;

  const stack: CategoryNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    allNodes.push(node);

    const normName = node.name.trim().toLowerCase();
    namesMap.set(normName, (namesMap.get(normName) ?? 0) + 1);

    if (node.anomalies.includes("single_child")) {
      singleChildCount += 1;
    }
    if (node.anomalies.includes("wildcard_name")) {
      wildcardCount += 1;
    }

    if (node.isLeaf) {
      leafNodesList.push(node);
      const tickets = node.totalTickets;
      depthDistribution[node.depth] = (depthDistribution[node.depth] ?? 0) + tickets;
    }

    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push(node.children[i]);
    }
  }

  let homonymGroupCount = 0;
  for (const count of namesMap.values()) {
    if (count > 1) {
      homonymGroupCount += 1;
    }
  }

  const totalNodes = allNodes.length;
  const leafNodes = leafNodesList.length;

  let deadNodes = 0;
  for (const node of allNodes) {
    if (node.totalTickets === 0) {
      deadNodes += 1;
    }
  }

  const structuralWastePercent =
    totalNodes > 0 ? roundTo((deadNodes / totalNodes) * 100, 1) : 0;

  const totalTicketsAllLeaves = leafNodesList.reduce(
    (acc, leaf) => acc + leaf.totalTickets,
    0,
  );

  let weightedAvgDepth = 0;
  if (totalTicketsAllLeaves > 0) {
    const sumWeightedDepth = leafNodesList.reduce(
      (acc, leaf) => acc + leaf.depth * leaf.totalTickets,
      0,
    );
    weightedAvgDepth = roundTo(sumWeightedDepth / totalTicketsAllLeaves, 2);
  }

  const sortedLeaves = [...leafNodesList].sort(
    (a, b) => b.totalTickets - a.totalTickets,
  );

  function calculateParetoPercent(k: number): number {
    if (totalTicketsAllLeaves === 0) return 0;
    const topLeaves = sortedLeaves.slice(0, k);
    const sum = topLeaves.reduce((acc, l) => acc + l.totalTickets, 0);
    return roundTo((sum / totalTicketsAllLeaves) * 100, 1);
  }

  const pareto: ParetoMetrics = {
    top1: calculateParetoPercent(1),
    top5: calculateParetoPercent(5),
    top10: calculateParetoPercent(10),
    top16: calculateParetoPercent(16),
    top50: calculateParetoPercent(50),
  };

  return {
    totalNodes,
    leafNodes,
    deadNodes,
    structuralWastePercent,
    weightedAvgDepth,
    pareto,
    depthDistribution,
    closureDistribution: { ...STATIC_CLOSURE_DISTRIBUTION },
    demoFields: ["closureDistribution"],
    anomalies: {
      singleChildCount,
      wildcardCount,
      homonymGroupCount,
    },
  };
}
