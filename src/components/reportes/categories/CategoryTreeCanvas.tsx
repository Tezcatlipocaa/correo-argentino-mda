import React, { useState, useRef, useEffect, useMemo, type MouseEvent } from "react";
import { Icon } from "@iconify/react";
import type { CategoryNode } from "@/types/categories";

interface Props {
  rootNode: CategoryNode;
  propuestaCNode?: CategoryNode;
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

const NODE_WIDTH = 230;
const NODE_HEIGHT = 88;
const HORIZONTAL_GAP = 90;
const VERTICAL_GAP = 24;

function getTicketBadgeClass(totalTickets: number): string {
  if (totalTickets === 0) {
    return "badge badge-sm font-mono opacity-40 bg-base-300/40 text-base-content/40 border-transparent";
  }
  if (totalTickets < 50) {
    return "badge badge-sm font-mono bg-base-200 text-base-content/80 border-base-300";
  }
  if (totalTickets < 200) {
    return "badge badge-sm font-mono font-medium bg-info/15 text-info border-info/30";
  }
  return "badge badge-sm font-mono font-bold bg-secondary/20 text-secondary border-secondary/35 shadow-xs";
}

export default function CategoryTreeCanvas({ rootNode, propuestaCNode, onSelectNode }: Props) {
  const [activeModel, setActiveModel] = useState<"actual" | "propuesta_c">("actual");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    const sourceNode = rootNode;
    if (sourceNode && sourceNode.children) {
      for (const child of sourceNode.children) {
        if (child.children && child.children.length > 0) {
          initial.add(child.id);
        }
      }
    }
    return initial;
  });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [pan, setPan] = useState<Point>({ x: 50, y: 150 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSwitchModel = (e: CustomEvent<{ model: "actual" | "propuesta_c" }>) => {
      if (e.detail?.model) {
        const nextModel = e.detail.model;
        setActiveModel(nextModel);
        setSelectedBranchId(null);
        const sourceNode = nextModel === "propuesta_c" && propuestaCNode ? propuestaCNode : rootNode;
        const initial = new Set<number>();
        if (sourceNode && sourceNode.children) {
          for (const child of sourceNode.children) {
            if (child.children && child.children.length > 0) {
              initial.add(child.id);
            }
          }
        }
        setCollapsedIds(initial);
        setZoom(1);
      }
    };

    const handleFilterBranch = (e: CustomEvent<{ branchId: number | null }>) => {
      setSelectedBranchId(e.detail.branchId ?? null);
      setZoom(1);
    };

    window.addEventListener("category:switch-model", handleSwitchModel as EventListener);
    window.addEventListener("category:filter-branch", handleFilterBranch as EventListener);
    return () => {
      window.removeEventListener("category:switch-model", handleSwitchModel as EventListener);
      window.removeEventListener("category:filter-branch", handleFilterBranch as EventListener);
    };
  }, [rootNode, propuestaCNode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheelNative = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.2), 3));
    };
    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelNative);
  }, []);


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

  const collapseAll = () => {
    const activeRoot =
      activeModel === "propuesta_c" && propuestaCNode ? propuestaCNode : rootNode;
    const allParentIds = new Set<number>();
    const collectParentIds = (node: CategoryNode) => {
      if (node.children && node.children.length > 0) {
        allParentIds.add(node.id);
        for (const child of node.children) {
          collectParentIds(child);
        }
      }
    };
    if (activeRoot) {
      collectParentIds(activeRoot);
    }
    setCollapsedIds(allParentIds);
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
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

  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.2));

  const { layoutNodes, connections, totalBounds, rootLayout } = useMemo(() => {
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

    const baseRootNode =
      activeModel === "propuesta_c" && propuestaCNode ? propuestaCNode : rootNode;

    let activeRootNode = baseRootNode;
    if (selectedBranchId !== null && baseRootNode && baseRootNode.children) {
      const branchMatch = baseRootNode.children.find((c) => c.id === selectedBranchId);
      if (branchMatch) {
        activeRootNode = branchMatch;
      }
    }

    if (activeRootNode) {
      layoutSubtree(activeRootNode, 0);

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
      rootLayout: nodes[nodes.length - 1] ?? null,
    };
  }, [rootNode, propuestaCNode, activeModel, collapsedIds, selectedBranchId]);

  const resetView = () => {
    const rootY = rootLayout ? rootLayout.y : 0;
    setPan({ x: 50, y: Math.max(50, Math.round(250 - rootY)) });
    setZoom(1);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFs = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isNowFs);
      setTimeout(resetView, 100);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [rootLayout]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {
            setIsFullscreen(false);
          });
        } else {
          setIsFullscreen(false);
        }
        setTimeout(resetView, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, rootLayout]);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement === container) {
      void document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
        setTimeout(resetView, 100);
      });
    } else if (isFullscreen) {
      setIsFullscreen(false);
      setTimeout(resetView, 100);
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        setIsFullscreen((prev) => !prev);
        setTimeout(resetView, 100);
      });
    } else {
      setIsFullscreen((prev) => !prev);
      setTimeout(resetView, 100);
    }
  };

  useEffect(() => {
    if (rootLayout) {
      setPan({ x: 50, y: Math.max(50, Math.round(250 - rootLayout.y)) });
    }
  }, [activeModel, selectedBranchId]);

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
      id="tree-canvas-container"
      ref={containerRef}
      className={`relative w-full overflow-hidden border border-base-300 bg-base-200 select-none cursor-grab active:cursor-grabbing transition-all ${
        isFullscreen
          ? "canvas-fullscreen is-fullscreen fixed inset-0 z-200 w-screen h-screen bg-base-100 p-4 rounded-none shadow-2xl"
          : "h-205 rounded-box"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-1.5 bg-base-100/95 backdrop-blur-md p-1.5 rounded-box shadow-md border border-base-300">
        <button
          type="button"
          onClick={expandAll}
          className="btn btn-xs btn-outline btn-neutral gap-1 text-xs"
          title="Expandir todos los nodos del árbol"
        >
          <Icon icon="boxicons:chevron-down-circle" width={13} height={13} />
          <span>Expandir todo</span>
        </button>

        <button
          type="button"
          onClick={collapseAll}
          className="btn btn-xs btn-outline btn-neutral gap-1 text-xs"
          title="Colapsar todos los nodos al nodo raíz"
        >
          <Icon icon="boxicons:chevron-up-circle" width={13} height={13} />
          <span>Colapsar todo</span>
        </button>

        <div className="divider divider-horizontal my-1 mx-0.5" />

        <div className="join border border-base-300 rounded-lg overflow-hidden bg-base-100">
          <button
            type="button"
            onClick={zoomOut}
            className="btn btn-xs btn-ghost join-item px-2 text-base-content/80 hover:text-base-content"
            title="Alejar zoom (-)"
            aria-label="Alejar"
          >
            <Icon icon="boxicons:minus" width={14} height={14} />
          </button>
          <span className="btn btn-ghost btn-xs join-item font-mono text-small px-2 min-w-12 text-center pointer-events-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="btn btn-xs btn-ghost join-item px-2 text-base-content/80 hover:text-base-content"
            title="Acercar zoom (+)"
            aria-label="Acercar"
          >
            <Icon icon="boxicons:plus" width={14} height={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={resetView}
          className="btn btn-xs btn-ghost text-xs text-base-content"
          title="Centrar vista en la raíz"
        >
          Centrar
        </button>

        <button
          id="btn-canvas-fullscreen"
          type="button"
          onClick={toggleFullscreen}
          className="btn btn-xs btn-primary btn-outline gap-1 text-xs"
          title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
          aria-pressed={isFullscreen}
        >
          <Icon
            icon={isFullscreen ? "boxicons:fullscreen-exit" : "boxicons:fullscreen"}
            width={14}
            height={14}
          />
          <span>{isFullscreen ? "Salir" : "Pantalla completa"}</span>
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

          return (
            <div
              key={node.id}
              onClick={(e) => handleNodeClick(node, e)}
              className="absolute card bg-base-100 border border-base-300 hover:border-secondary shadow-xs hover:shadow-sm transition-all cursor-pointer p-3 flex flex-col justify-between rounded-xl overflow-hidden"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="font-bold text-xs text-base-content leading-snug line-clamp-2 flex-1"
                  title={node.name}
                >
                  {node.name}
                </span>
                <span
                  className={`shrink-0 ${getTicketBadgeClass(node.totalTickets)}`}
                  title={`${node.totalTickets.toLocaleString("es-AR")} tickets`}
                >
                  {`${node.totalTickets.toLocaleString("es-AR")} tk`}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-base-200">
                <span className="text-xxs font-mono text-base-content/50 tracking-wide">
                  {hasChildren ? `${childrenCount} ${childrenCount === 1 ? "hijo" : "hijos"}` : "Hoja"}
                </span>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => toggleCollapse(node.id, e)}
                    className="btn btn-xs btn-outline btn-neutral gap-1 text-small h-6 min-h-0 px-2"
                    title={isCollapsed ? `Expandir rama (${childrenCount} ${childrenCount === 1 ? "hijo" : "hijos"})` : "Plegar rama al padre"}
                    aria-label={isCollapsed ? `Expandir rama (${childrenCount} ${childrenCount === 1 ? "hijo" : "hijos"})` : "Plegar rama al padre"}
                  >
                    <Icon
                      icon={isCollapsed ? "boxicons:plus" : "boxicons:minus"}
                      width={11}
                      height={11}
                    />
                    <span>{isCollapsed ? `+${childrenCount}` : "Plegar"}</span>
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
