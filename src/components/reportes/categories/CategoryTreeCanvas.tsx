import React, { useState, useRef, useEffect, useMemo, type MouseEvent, type WheelEvent } from "react";
import type { CategoryNode, CategoryNodeStatus } from "@/types/categories";

interface Props {
  rootNode: CategoryNode;
  onSelectNode?: (node: CategoryNode) => void;
}

interface Point {
  x: number;
  y: number;
}

interface LayoutNode {
  node: CategoryNode;
  x: number;
  y: number;
  width: number;
  height: number;
  isCollapsed: boolean;
  hasChildren: boolean;
  childrenCount: number;
}

interface LayoutConnection {
  id: string;
  from: Point;
  to: Point;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const HORIZONTAL_GAP = 90;
const VERTICAL_GAP = 20;

export default function CategoryTreeCanvas({ rootNode, onSelectNode }: Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [pan, setPan] = useState<Point>({ x: 50, y: 150 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = (id: number, e: MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.2), 3));
  };

  const resetView = () => {
    setPan({ x: 50, y: 150 });
    setZoom(1);
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.2));

  const { layoutNodes, connections, totalBounds } = useMemo(() => {
    const nodes: LayoutNode[] = [];
    const conns: LayoutConnection[] = [];
    let currentY = 0;

    function layoutSubtree(node: CategoryNode, depth: number): { top: number; bottom: number; center: number } {
      const isCollapsed = collapsedIds.has(node.id);
      const hasChildren = node.children && node.children.length > 0;
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
        };
        nodes.push(layoutItem);

        return { top: y, bottom: y + NODE_HEIGHT, center: y + NODE_HEIGHT / 2 };
      }

      const childCenters: number[] = [];
      let minTop = Infinity;
      let maxBottom = -Infinity;

      for (const child of node.children) {
        const childLayout = layoutSubtree(child, depth + 1);
        childCenters.push(childLayout.center);
        minTop = Math.min(minTop, childLayout.top);
        maxBottom = Math.max(maxBottom, childLayout.bottom);

        conns.push({
          id: `${node.id}->${child.id}`,
          from: { x: x + NODE_WIDTH, y: 0 },
          to: { x: (depth + 1) * (NODE_WIDTH + HORIZONTAL_GAP), y: childLayout.center },
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
      };
      nodes.push(layoutItem);

      return { top: Math.min(y, minTop), bottom: Math.max(y + NODE_HEIGHT, maxBottom), center: centerY };
    }

    if (rootNode) {
      layoutSubtree(rootNode, 0);

      const nodeMap = new Map<number, LayoutNode>();
      for (const n of nodes) {
        nodeMap.set(n.node.id, n);
      }

      for (const c of conns) {
        const [fromId] = c.id.split("->").map(Number);
        const fromNode = nodeMap.get(fromId);
        if (fromNode) {
          c.from.y = fromNode.y + fromNode.height / 2;
        }
      }
    }

    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    return {
      layoutNodes: nodes,
      connections: conns,
      totalBounds: { width: maxX + 200, height: maxY + 200 },
    };
  }, [rootNode, collapsedIds]);

  const getBadgeStyle = (status: CategoryNodeStatus) => {
    switch (status) {
      case "hot":
        return "badge-error text-error-content";
      case "dead":
        return "badge-neutral text-neutral-content opacity-70";
      case "zero":
        return "badge-warning text-warning-content";
      case "normal":
      default:
        return "badge-info text-info-content";
    }
  };

  const getStatusLabel = (status: CategoryNodeStatus) => {
    switch (status) {
      case "hot":
        return "Caliente (≥200)";
      case "dead":
        return "Desierto (0)";
      case "zero":
        return "Rama Vacía";
      case "normal":
      default:
        return "Activo";
    }
  };

  const handleNodeClick = (node: CategoryNode, e: MouseEvent) => {
    e.stopPropagation();
    if (onSelectNode) {
      onSelectNode(node);
    }
    const event = new CustomEvent("category:inspect", {
      bubbles: true,
      detail: { node },
    });
    containerRef.current?.dispatchEvent(event);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] overflow-hidden rounded-box border border-base-300 bg-base-200 select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-base-100/90 backdrop-blur-md p-1.5 rounded-box shadow-md border border-base-300">
        <button
          type="button"
          onClick={zoomIn}
          className="btn btn-xs btn-ghost btn-square text-base-content"
          title="Acercar (+)"
        >
          <span className="text-base font-bold">+</span>
        </button>
        <span className="text-xs font-mono px-1 min-w-[3rem] text-center text-base-content/70">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomOut}
          className="btn btn-xs btn-ghost btn-square text-base-content"
          title="Alejar (-)"
        >
          <span className="text-base font-bold">-</span>
        </button>
        <button
          type="button"
          onClick={resetView}
          className="btn btn-xs btn-ghost text-xs text-base-content"
          title="Centrar Vista"
        >
          Centrar
        </button>
      </div>

      <div
        className="absolute origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: totalBounds.width,
          height: totalBounds.height,
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{ width: "100%", height: "100%" }}
        >
          {connections.map((c) => {
            const dx = c.to.x - c.from.x;
            const cpx1 = c.from.x + dx * 0.5;
            const cpy1 = c.from.y;
            const cpx2 = c.to.x - dx * 0.5;
            const cpy2 = c.to.y;
            const pathData = `M ${c.from.x} ${c.from.y} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${c.to.x} ${c.to.y}`;

            return (
              <path
                key={c.id}
                d={pathData}
                fill="none"
                stroke="currentColor"
                className="text-base-content/25 transition-colors"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {layoutNodes.map((item) => {
          const { node, x, y, width, height, isCollapsed, hasChildren, childrenCount } = item;
          const isDead = node.status === "dead" || node.status === "zero";

          return (
            <div
              key={node.id}
              onClick={(e) => handleNodeClick(node, e)}
              className={`absolute card bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:border-primary transition-all cursor-pointer p-3 flex flex-col justify-between ${
                isDead ? "opacity-75 bg-base-100/70" : ""
              }`}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              <div className="flex items-start justify-between gap-1 overflow-hidden">
                <span
                  className="font-medium text-xs leading-tight text-base-content truncate"
                  title={node.name}
                >
                  {node.name}
                </span>
                <span
                  className={`badge badge-xs text-[10px] shrink-0 ${getBadgeStyle(node.status)}`}
                >
                  {node.totalTickets}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1 pt-1 border-t border-base-200">
                <span className="text-[10px] text-base-content/60 capitalize truncate">
                  {getStatusLabel(node.status)}
                </span>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => toggleCollapse(node.id, e)}
                    className="btn btn-circle btn-xs bg-base-200 hover:bg-base-300 border-none text-[10px] h-5 w-5 min-h-0"
                    title={isCollapsed ? "Expandir rama" : "Colapsar rama"}
                  >
                    {isCollapsed ? `+${childrenCount}` : "-"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
