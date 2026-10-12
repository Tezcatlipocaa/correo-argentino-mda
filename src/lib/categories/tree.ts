import type { RawCategory, CategoryNode } from "./types";

export function buildCategoryTree(
  rawCategories: RawCategory[],
  rootId: number,
): CategoryNode | null {
  const rootRaw = rawCategories.find((cat) => cat.id === rootId);
  if (!rootRaw) return null;

  const childrenMap = new Map<number, RawCategory[]>();
  for (const cat of rawCategories) {
    if (cat.parentId !== null) {
      const list = childrenMap.get(cat.parentId) ?? [];
      list.push(cat);
      childrenMap.set(cat.parentId, list);
    }
  }

  function createNode(raw: RawCategory, depth: number): CategoryNode {
    const rawChildren = childrenMap.get(raw.id) ?? [];
    const children = rawChildren.map((child) => createNode(child, depth + 1));
    const childrenTotalTickets = children.reduce(
      (sum, child) => sum + child.totalTickets,
      0,
    );

    return {
      id: raw.id,
      name: raw.name,
      parentId: raw.parentId,
      directTickets: raw.ticketCount,
      totalTickets: raw.ticketCount + childrenTotalTickets,
      depth,
      children,
    };
  }

  return createNode(rootRaw, 0);
}
