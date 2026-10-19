import type {
  CategoryNode,
  CategoryNodeAnomaly,
  CategoryNodeStatus,
  RawCategoryItem,
} from "../../types/categories";

const WILDCARD_NAMES = new Set(["consulta", "otro", "otros"]);

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveStatus(totalTickets: number, isLeaf: boolean): CategoryNodeStatus {
  if (totalTickets === 0) {
    return isLeaf ? "dead" : "zero";
  }
  if (totalTickets >= 200) {
    return "hot";
  }
  return "normal";
}

export function buildCategoryTree(
  items: RawCategoryItem[],
  rootId: number,
): CategoryNode {
  const itemMap = new Map<number, RawCategoryItem>();
  const childrenMap = new Map<number, RawCategoryItem[]>();

  for (const item of items) {
    itemMap.set(item.id, item);
    if (item.parentId !== null) {
      const existing = childrenMap.get(item.parentId) ?? [];
      existing.push(item);
      childrenMap.set(item.parentId, existing);
    }
  }

  const rootItem = itemMap.get(rootId);
  if (!rootItem) {
    throw new Error(`Root category item with id ${rootId} not found`);
  }

  function assembleNode(
    item: RawCategoryItem,
    parentPath: string | null,
    depth: number,
  ): CategoryNode {
    const rawChildren = childrenMap.get(item.id) ?? [];
    const isLeaf = rawChildren.length === 0;
    const currentPath = parentPath ? `${parentPath} » ${item.name}` : item.name;

    const children: CategoryNode[] = [];
    for (const childItem of rawChildren) {
      children.push(assembleNode(childItem, currentPath, depth + 1));
    }

    const anomalies: CategoryNodeAnomaly[] = [];
    if (!isLeaf && children.length === 1) {
      anomalies.push("single_child");
    }

    if (WILDCARD_NAMES.has(normalizeName(item.name))) {
      anomalies.push("wildcard_name");
    }

    const totalTickets = item.totalTickets ?? item.ticketCount ?? 0;
    const status = resolveStatus(totalTickets, isLeaf);

    return {
      id: item.id,
      parentId: item.parentId,
      name: item.name,
      totalTickets,
      ticketCount: totalTickets,
      path: currentPath,
      depth,
      isLeaf,
      status,
      anomalies,
      children,
    };
  }

  return assembleNode(rootItem, null, 1);
}
