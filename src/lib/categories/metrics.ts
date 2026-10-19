import type { CategoryNode, CategoryTreeMetrics } from "./types";

export function computeTreeMetrics(root: CategoryNode): CategoryTreeMetrics {
  let totalNodes = 0;
  let maxDepth = 0;
  let leafNodesCount = 0;
  let internalNodesCount = 0;
  let totalChildrenCount = 0;

  function traverse(node: CategoryNode) {
    totalNodes++;
    if (node.depth > maxDepth) {
      maxDepth = node.depth;
    }

    if (node.children.length === 0) {
      leafNodesCount++;
    } else {
      internalNodesCount++;
      totalChildrenCount += node.children.length;
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);

  const avgBranchingFactor =
    internalNodesCount > 0
      ? Number((totalChildrenCount / internalNodesCount).toFixed(2))
      : 0;

  return {
    totalNodes,
    maxDepth,
    totalTickets: root.totalTickets,
    leafNodesCount,
    avgBranchingFactor,
  };
}
