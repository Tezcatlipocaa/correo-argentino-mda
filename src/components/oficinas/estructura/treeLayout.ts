import type { OfficeTreeNode } from "@/lib/offices/structure-tree";

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 108;
export const HORIZONTAL_GAP = 96;
export const VERTICAL_GAP = 24;

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  node: OfficeTreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  isCollapsed: boolean;
  hasChildren: boolean;
  childrenCount: number;
  depth: number;
}

export interface LayoutConnection {
  id: string;
  fromId: string;
  toId: string;
  from: Point;
  to: Point;
  color?: string;
}

export interface TreeLayoutResult {
  nodes: LayoutNode[];
  connections: LayoutConnection[];
  totalWidth: number;
  totalHeight: number;
}

export interface OfficeFilterOptions {
  headquartersOnly?: boolean;
  headquartersMode?: "all" | "hq_only" | "dependent_only";
  minTickets?: number;
  ticketTier?: "all" | "with_tickets" | "zero_tickets" | "high_tickets";
  officeTypes?: string[];
  regionId?: string;
  provinceCode?: string;
  terminalsMode?: "all" | "with_terminals" | "zero_terminals";
}

export interface OfficeTypeCount {
  type: string;
  label: string;
  count: number;
}

export interface NodeMatchResult {
  targetId: string;
  node: OfficeTreeNode;
  path: string[];
}

export interface ViewportBox {
  pan: Point;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  overscan?: number;
}

/**
 * Deja la raíz y las 5 regiones siempre expandidas por defecto.
 * Colapsa todas las provincias y niveles inferiores.
 */
export function getInitialCollapsedIds(rootNode: OfficeTreeNode): Set<string> {
  const collapsed = new Set<string>();

  function traverse(node: OfficeTreeNode, depth: number) {
    if (!node.children || node.children.length === 0) return;

    if (depth >= 2) {
      collapsed.add(node.id);
    }

    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }

  traverse(rootNode, 0);
  return collapsed;
}

/**
 * Extrae los tipos de sucursal únicos presentes en el árbol junto a su conteo real.
 */
export function extractAvailableOfficeTypes(rootNode: OfficeTreeNode): OfficeTypeCount[] {
  const counts = new Map<string, number>();

  function traverse(node: OfficeTreeNode) {
    if (node.type === "office" && node.officeType) {
      const typeKey = node.officeType.trim();
      counts.set(typeKey, (counts.get(typeKey) || 0) + 1);
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);

  return Array.from(counts.entries())
    .map(([type, count]) => ({
      type,
      label: type.replace(/_/g, " "),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

/**
 * Filtra el árbol de oficinas de acuerdo con opciones combinadas de tickets,
 * jerarquía de cabeceras, tipos de sucursal de la DB, región/provincia y terminales.
 */
export function filterOfficeTree(
  node: OfficeTreeNode,
  filters: OfficeFilterOptions,
): OfficeTreeNode | null {
  if (node.type === "office") {
    // 1. Cabeceras
    const isHq = Boolean(node.isHeadquarter);
    if (filters.headquartersOnly && !isHq) return null;
    if (filters.headquartersMode === "hq_only" && !isHq) return null;
    if (filters.headquartersMode === "dependent_only" && isHq) return null;

    // 2. Tickets
    const tickets = node.totalTickets || 0;
    if (typeof filters.minTickets === "number" && tickets < filters.minTickets) return null;
    if (filters.ticketTier === "with_tickets" && tickets <= 0) return null;
    if (filters.ticketTier === "zero_tickets" && tickets > 0) return null;
    if (filters.ticketTier === "high_tickets" && tickets < 50) return null;

    // 3. Tipos de sucursal
    if (filters.officeTypes && filters.officeTypes.length > 0) {
      const offType = (node.officeType || "").trim();
      if (!filters.officeTypes.includes(offType)) return null;
    }

    // 4. Terminales
    const terms = node.totalTerminals || 0;
    if (filters.terminalsMode === "with_terminals" && terms <= 0) return null;
    if (filters.terminalsMode === "zero_terminals" && terms > 0) return null;

    return { ...node, children: [] };
  }

  // Filtrado geográfico directo en niveles region y province
  if (node.type === "region" && filters.regionId && filters.regionId !== "all") {
    if (node.id !== filters.regionId && node.id !== `reg-${filters.regionId}`) {
      return null;
    }
  }

  if (node.type === "province" && filters.provinceCode && filters.provinceCode !== "all") {
    if (!node.id.endsWith(`-${filters.provinceCode}`)) {
      return null;
    }
  }

  const filteredChildren: OfficeTreeNode[] = [];
  let totalOffices = 0;
  let totalTickets = 0;
  let totalTerminals = 0;

  for (const child of node.children) {
    const filteredChild = filterOfficeTree(child, filters);
    if (filteredChild) {
      filteredChildren.push(filteredChild);
      totalOffices += filteredChild.totalOffices;
      totalTickets += filteredChild.totalTickets;
      totalTerminals += filteredChild.totalTerminals;
    }
  }

  if (filteredChildren.length === 0 && node.type !== "root") {
    return null;
  }

  return {
    ...node,
    totalOffices,
    totalTickets,
    totalTerminals,
    children: filteredChildren,
  };
}

/**
 * Compatibilidad hacia atrás: filtra exclusivamente por cabecera.
 */
export function filterTreeByHeadquarters(node: OfficeTreeNode): OfficeTreeNode | null {
  return filterOfficeTree(node, { headquartersOnly: true });
}

/**
 * Busca todas las coincidencias con el término y retorna sus rutas para navegación 1/N.
 */
export function findAllMatchingNodes(
  rootNode: OfficeTreeNode,
  query: string,
): NodeMatchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const results: NodeMatchResult[] = [];

  function traverse(node: OfficeTreeNode, currentPath: string[]) {
    const nextPath = [...currentPath, node.id];
    const codeMatch = node.code && node.code.toUpperCase().includes(q);
    const nameMatch = node.name.toUpperCase().includes(q);

    if (codeMatch || nameMatch) {
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
 * Busca el camino de IDs hasta el primer nodo coincidente (compatibilidad).
 */
export function findPathToNode(node: OfficeTreeNode, query: string): string[] | null {
  const matches = findAllMatchingNodes(node, query);
  return matches.length > 0 ? matches[0].path : null;
}

/**
 * Calcula las coordenadas X e Y de cada nodo visible y las conexiones SVG.
 */
export function computeTreeLayout(
  rootNode: OfficeTreeNode,
  collapsedIds: Set<string>,
): TreeLayoutResult {
  const nodes: LayoutNode[] = [];
  const connections: LayoutConnection[] = [];
  let currentY = 0;
  let maxRight = 0;
  let maxBottom = 0;

  function layoutSubtree(
    node: OfficeTreeNode,
    depth: number,
  ): { top: number; bottom: number; center: number } {
    const isCollapsed = collapsedIds.has(node.id);
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const x = depth * (NODE_WIDTH + HORIZONTAL_GAP);

    if (!hasChildren || isCollapsed) {
      const y = currentY;
      currentY += NODE_HEIGHT + VERTICAL_GAP;

      const layoutItem: LayoutNode = {
        node,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        isCollapsed,
        hasChildren,
        childrenCount: node.children ? node.children.length : 0,
        depth,
      };
      nodes.push(layoutItem);

      maxRight = Math.max(maxRight, x + NODE_WIDTH);
      maxBottom = Math.max(maxBottom, y + NODE_HEIGHT);

      return {
        top: y,
        bottom: y + NODE_HEIGHT,
        center: y + NODE_HEIGHT / 2,
      };
    }

    const childCenters: number[] = [];
    let minTop = Infinity;
    let maxBottomSub = -Infinity;

    for (const child of node.children) {
      const childLayout = layoutSubtree(child, depth + 1);
      childCenters.push(childLayout.center);
      minTop = Math.min(minTop, childLayout.top);
      maxBottomSub = Math.max(maxBottomSub, childLayout.bottom);

      connections.push({
        id: `${node.id}->${child.id}`,
        fromId: node.id,
        toId: child.id,
        from: { x: x + NODE_WIDTH, y: 0 },
        to: {
          x: (depth + 1) * (NODE_WIDTH + HORIZONTAL_GAP),
          y: childLayout.center,
        },
        color: node.color || child.color,
      });
    }

    const firstCenter = childCenters[0];
    const lastCenter = childCenters[childCenters.length - 1];
    const centerY = (firstCenter + lastCenter) / 2;
    const y = centerY - NODE_HEIGHT / 2;

    const layoutItem: LayoutNode = {
      node,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      isCollapsed,
      hasChildren,
      childrenCount: node.children.length,
      depth,
    };
    nodes.push(layoutItem);

    for (const conn of connections) {
      if (conn.fromId === node.id) {
        conn.from.y = centerY;
      }
    }

    maxRight = Math.max(maxRight, x + NODE_WIDTH);
    maxBottom = Math.max(maxBottom, Math.max(y + NODE_HEIGHT, maxBottomSub));

    return {
      top: Math.min(y, minTop),
      bottom: Math.max(y + NODE_HEIGHT, maxBottomSub),
      center: centerY,
    };
  }

  layoutSubtree(rootNode, 0);

  return {
    nodes,
    connections,
    totalWidth: maxRight,
    totalHeight: maxBottom,
  };
}

/**
 * Calcula pan y zoom óptimos para encuadrar todo el árbol en el contenedor visible.
 */
export function computeFitToScreen(options: {
  totalWidth: number;
  totalHeight: number;
  containerWidth: number;
  containerHeight: number;
  padding?: number;
}): { pan: Point; zoom: number } {
  const { totalWidth, totalHeight, containerWidth, containerHeight, padding = 40 } = options;

  if (totalWidth <= 0 || totalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { pan: { x: 40, y: 40 }, zoom: 1 };
  }

  const availableW = Math.max(containerWidth - padding * 2, 100);
  const availableH = Math.max(containerHeight - padding * 2, 100);

  const scaleX = availableW / totalWidth;
  const scaleY = availableH / totalHeight;
  const targetZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.2);

  const scaledW = totalWidth * targetZoom;
  const scaledH = totalHeight * targetZoom;

  const panX = Math.round((containerWidth - scaledW) / 2);
  const panY = Math.round((containerHeight - scaledH) / 2);

  return {
    pan: { x: Math.max(panX, padding), y: Math.max(panY, padding) },
    zoom: Number(targetZoom.toFixed(2)),
  };
}

/**
 * Virtualización espacial 2D (Viewport Culling): devuelve solo los nodos visibles.
 */
export function filterVisibleViewport(
  nodes: LayoutNode[],
  box: ViewportBox,
): LayoutNode[] {
  const { pan, zoom, viewportWidth, viewportHeight, overscan = 350 } = box;

  // Inversa del transform: rectángulo del viewport en coordenadas del árbol
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
