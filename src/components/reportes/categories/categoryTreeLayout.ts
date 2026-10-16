import type { CategoryNode } from "@/types/categories";

export const CATEGORY_NODE_WIDTH = 280;
export const CATEGORY_NODE_HEIGHT = 108;
export const CATEGORY_HORIZONTAL_GAP = 96;
export const CATEGORY_VERTICAL_GAP = 24;

export interface CategoryPoint {
  x: number;
  y: number;
}

export interface CategoryLayoutNode {
  node: CategoryNode;
  x: number;
  y: number;
  width: number;
  height: number;
  isCollapsed: boolean;
  hasChildren: boolean;
  childrenCount: number;
}

export interface CategoryLayoutConnection {
  id: string;
  from: CategoryPoint;
  to: CategoryPoint;
}

export interface CategoryTreeLayoutResult {
  nodes: CategoryLayoutNode[];
  connections: CategoryLayoutConnection[];
  totalWidth: number;
  totalHeight: number;
  rootLayout: CategoryLayoutNode | null;
}

export interface CategoryFilterOptions {
  minTickets?: number;
  ticketTier?: "all" | "zero" | "low" | "medium" | "high";
  anomalies?: string[];
  selectedBranchId?: number | null;
  maxDepth?: number;
}

export interface CategoryMatchResult {
  targetId: number;
  node: CategoryNode;
  path: number[];
}

export interface CategoryViewportBox {
  pan: CategoryPoint;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  overscan?: number;
}

/**
 * Filtra el árbol de categorías por volumen de tickets, anomalías, rama y profundidad.
 */
export function filterCategoryTree(
  node: CategoryNode,
  filters: CategoryFilterOptions,
): CategoryNode | null {
  // 1. Filtrado de rama raíz inmediata si aplica
  if (
    filters.selectedBranchId !== null &&
    filters.selectedBranchId !== undefined &&
    node.depth === 1 &&
    node.id !== filters.selectedBranchId
  ) {
    return null;
  }

  // 2. Profundidad máxima: si este nodo ya está en la profundidad límite, se devuelve como nodo hoja
  if (typeof filters.maxDepth === "number" && node.depth >= filters.maxDepth) {
    return { ...node, children: [], isLeaf: true };
  }

  const isLeaf = Boolean(node.isLeaf || !node.children || node.children.length === 0);

  if (isLeaf) {
    const tickets = node.totalTickets || 0;

    // Volumen mínimo numérico
    if (typeof filters.minTickets === "number" && tickets < filters.minTickets) {
      return null;
    }

    // Tramos de tickets
    if (filters.ticketTier === "zero" && tickets !== 0) return null;
    if (filters.ticketTier === "low" && (tickets < 1 || tickets >= 50)) return null;
    if (filters.ticketTier === "medium" && (tickets < 50 || tickets >= 200)) return null;
    if (filters.ticketTier === "high" && tickets < 200) return null;

    // Anomalías
    if (filters.anomalies && filters.anomalies.length > 0) {
      const hasAnomaly = (node.anomalies || []).some((a) => filters.anomalies!.includes(a));
      const matchesStatus = filters.anomalies.includes(node.status);
      if (!hasAnomaly && !matchesStatus) return null;
    }

    return { ...node, children: [] };
  }

  const filteredChildren: CategoryNode[] = [];
  let totalTickets = 0;

  for (const child of node.children || []) {
    const filteredChild = filterCategoryTree(child, filters);
    if (filteredChild) {
      filteredChildren.push(filteredChild);
      totalTickets += filteredChild.totalTickets || 0;
    }
  }

  // Si no quedan hijos y no es la raíz, evaluamos si el propio nodo padre califica por anomalía o si tiene tickets
  if (filteredChildren.length === 0 && node.depth > 0) {
    if (filters.anomalies && filters.anomalies.length > 0) {
      const hasAnomaly = (node.anomalies || []).some((a) => filters.anomalies!.includes(a));
      const matchesStatus = filters.anomalies.includes(node.status);
      if (hasAnomaly || matchesStatus) {
        return { ...node, children: [] };
      }
      return null;
    }
    // Si se aplicó filtro de tickets/anomalías y ningún hijo coincidió, se descarta
    if (filters.minTickets !== undefined || filters.ticketTier !== undefined) {
      return null;
    }
    // Si no había filtro restrictivo, conservamos el nodo con 0 hijos
    return { ...node, children: [] };
  }

  return {
    ...node,
    totalTickets: node.depth === 0 ? node.totalTickets : totalTickets,
    children: filteredChildren,
  };
}

/**
 * Busca todas las categorías que coinciden con la consulta para navegación 1/N.
 */
export function findCategoryMatches(
  rootNode: CategoryNode,
  query: string,
): CategoryMatchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: CategoryMatchResult[] = [];

  function traverse(node: CategoryNode, currentPath: number[]) {
    const nextPath = [...currentPath, node.id];
    const nameMatch = node.name.toLowerCase().includes(q);
    const pathMatch = node.path && node.path.toLowerCase().includes(q);
    const idMatch = String(node.id).includes(q);

    if (nameMatch || pathMatch || idMatch) {
      results.push({
        targetId: node.id,
        node,
        path: nextPath,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, nextPath);
      }
    }
  }

  traverse(rootNode, []);
  return results;
}

/**
 * Calcula coordenadas X e Y y conexiones SVG para el árbol de categorías.
 */
export function computeCategoryTreeLayout(
  rootNode: CategoryNode,
  collapsedIds: Set<number>,
): CategoryTreeLayoutResult {
  const nodes: CategoryLayoutNode[] = [];
  const connections: CategoryLayoutConnection[] = [];
  let currentY = 0;

  function layoutSubtree(
    node: CategoryNode,
    depth: number,
  ): { top: number; bottom: number; center: number } {
    const isCollapsed = collapsedIds.has(node.id);
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const x = depth * (CATEGORY_NODE_WIDTH + CATEGORY_HORIZONTAL_GAP);

    if (!hasChildren || isCollapsed) {
      const y = currentY;
      currentY += CATEGORY_NODE_HEIGHT + CATEGORY_VERTICAL_GAP;

      const layoutItem: CategoryLayoutNode = {
        node,
        x,
        y,
        width: CATEGORY_NODE_WIDTH,
        height: CATEGORY_NODE_HEIGHT,
        isCollapsed,
        hasChildren,
        childrenCount: node.children ? node.children.length : 0,
      };
      nodes.push(layoutItem);

      return {
        top: y,
        bottom: y + CATEGORY_NODE_HEIGHT,
        center: y + CATEGORY_NODE_HEIGHT / 2,
      };
    }

    const childCenters: number[] = [];
    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (const child of node.children) {
      const childLayout = layoutSubtree(child, depth + 1);
      childCenters.push(childLayout.center);
      minTop = Math.min(minTop, childLayout.top);
      maxBottom = Math.max(maxBottom, childLayout.bottom);

      connections.push({
        id: `${node.id}->${child.id}`,
        from: { x: x + CATEGORY_NODE_WIDTH, y: 0 },
        to: {
          x: (depth + 1) * (CATEGORY_NODE_WIDTH + CATEGORY_HORIZONTAL_GAP),
          y: childLayout.center,
        },
      });
    }

    const firstCenter = childCenters[0];
    const lastCenter = childCenters[childCenters.length - 1];
    const centerY = (firstCenter + lastCenter) / 2;
    const y = centerY - CATEGORY_NODE_HEIGHT / 2;

    const layoutItem: CategoryLayoutNode = {
      node,
      x,
      y,
      width: CATEGORY_NODE_WIDTH,
      height: CATEGORY_NODE_HEIGHT,
      isCollapsed,
      hasChildren,
      childrenCount: node.children.length,
    };
    nodes.push(layoutItem);

    return {
      top: Math.min(y, minTop),
      bottom: Math.max(y + CATEGORY_NODE_HEIGHT, maxBottom),
      center: centerY,
    };
  }

  layoutSubtree(rootNode, 0);

  const nodeMap = new Map<number, CategoryLayoutNode>();
  for (const n of nodes) {
    nodeMap.set(n.node.id, n);
  }

  for (const c of connections) {
    const [fromId] = c.id.split("->").map(Number);
    const fromNode = nodeMap.get(fromId);
    if (fromNode) {
      c.from.y = fromNode.y + fromNode.height / 2;
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return {
    nodes,
    connections,
    totalWidth: maxX + 160,
    totalHeight: maxY + 160,
    rootLayout: nodes[nodes.length - 1] ?? null,
  };
}

/**
 * Viewport Culling 2D para árbol de categorías.
 */
export function filterCategoryVisibleViewport(
  nodes: CategoryLayoutNode[],
  box: CategoryViewportBox,
): CategoryLayoutNode[] {
  const { pan, zoom, viewportWidth, viewportHeight, overscan = 350 } = box;

  const visibleMinX = (-pan.x - overscan) / zoom;
  const visibleMaxX = (-pan.x + viewportWidth + overscan) / zoom;
  const visibleMinY = (-pan.y - overscan) / zoom;
  const visibleMaxY = (-pan.y + viewportHeight + overscan) / zoom;

  return nodes.filter((n) => {
    const nodeMaxX = n.x + n.width;
    const nodeMaxY = n.y + n.height;

    const overlapsX = n.x <= visibleMaxX && nodeMaxX >= visibleMinX;
    const overlapsY = n.y <= visibleMaxY && nodeMaxY >= visibleMinY;

    return overlapsX && overlapsY;
  });
}

export const filterVisibleCategoryViewport = filterCategoryVisibleViewport;

