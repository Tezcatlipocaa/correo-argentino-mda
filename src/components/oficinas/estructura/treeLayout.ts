import type { OfficeTreeNode } from "@/lib/offices/structure-tree";

export const NODE_WIDTH = 250;
export const NODE_HEIGHT = 86;
export const HORIZONTAL_GAP = 90;
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

/**
 * Deja la raíz y las 5 regiones siempre expandidas por defecto.
 * Colapsa todas las provincias y niveles inferiores.
 */
export function getInitialCollapsedIds(rootNode: OfficeTreeNode): Set<string> {
  const collapsed = new Set<string>();

  function traverse(node: OfficeTreeNode, depth: number) {
    if (!node.children || node.children.length === 0) return;

    // Profundidad 0 (root) y 1 (regiones) se mantienen desplegadas
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
        from: { x: x + NODE_WIDTH, y: 0 }, // Y se ajusta tras calcular el centro
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

    // Actualizar coordenadas de salida para las conexiones salientes de este nodo
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
 * Busca un nodo por NIS o texto y devuelve el camino completo de IDs desde la raíz.
 */
export function findPathToNode(
  node: OfficeTreeNode,
  query: string,
): string[] | null {
  const q = query.trim().toUpperCase();
  if (!q) return null;

  const codeMatch = node.code && node.code.toUpperCase() === q;
  const nameMatch = node.name.toUpperCase().includes(q);

  if (codeMatch || (node.type === "office" && nameMatch)) {
    return [node.id];
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const subPath = findPathToNode(child, query);
      if (subPath) {
        return [node.id, ...subPath];
      }
    }
  }

  return null;
}

/**
 * Filtra el árbol completo para conservar únicamente oficinas cabecera y sus ancestros.
 */
export function filterTreeByHeadquarters(
  node: OfficeTreeNode,
): OfficeTreeNode | null {
  if (node.type === "office") {
    return node.isHeadquarter ? { ...node, children: [] } : null;
  }

  const filteredChildren: OfficeTreeNode[] = [];
  let totalOffices = 0;
  let totalTickets = 0;
  let totalTerminals = 0;

  for (const child of node.children) {
    const filteredChild = filterTreeByHeadquarters(child);
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
