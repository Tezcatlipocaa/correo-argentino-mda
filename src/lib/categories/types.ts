export interface RawCategory {
  id: number;
  name: string;
  parentId: number | null;
  ticketCount: number;
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  directTickets: number;
  totalTickets: number;
  depth: number;
  children: CategoryNode[];
}

export interface CategoryTreeMetrics {
  totalNodes: number;
  maxDepth: number;
  totalTickets: number;
  leafNodesCount: number;
  avgBranchingFactor: number;
}

export interface CategoryCatalogReport {
  tree: CategoryNode;
  metrics: CategoryTreeMetrics;
  cachedAt: string;
}
