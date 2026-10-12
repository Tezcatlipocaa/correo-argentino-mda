export interface RawCategoryItem {
  id: number;
  parentId: number | null;
  name: string;
  totalTickets?: number;
  ticketCount?: number;
}

export type CategoryNodeStatus = "dead" | "zero" | "hot" | "normal";

export type CategoryNodeAnomaly = "single_child" | "wildcard_name";

export interface CategoryNode {
  id: number;
  parentId: number | null;
  name: string;
  totalTickets: number;
  ticketCount?: number;
  path: string;
  depth: number;
  isLeaf: boolean;
  status: CategoryNodeStatus;
  anomalies: CategoryNodeAnomaly[];
  children: CategoryNode[];
}
